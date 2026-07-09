import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPlan, type PlanId } from './plans';

// Use this service inside other services (products, orders, staff) to check
// whether the tenant's current plan allows a given action, instead of
// duplicating plan-limit logic across modules.
@Injectable()
export class PlanEnforcementService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Check product limit ────────────────────────────────────────────────────
  async assertCanAddProduct(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = getPlan(plan).limits;

    if (limits.maxProducts === -1) return; // unlimited

    const count = await this.prisma.product.count({
      where: { tenantId, status: { not: 'ARCHIVED' } },
    });

    if (count >= limits.maxProducts) {
      throw new ForbiddenException(
        `Your ${plan} plan allows up to ${limits.maxProducts} products. ` +
        `Upgrade to add more.`,
      );
    }
  }

  // ── Check staff limit ──────────────────────────────────────────────────────
  async assertCanAddStaff(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = getPlan(plan).limits;

    if (limits.maxStaffUsers === -1) return;

    if (limits.maxStaffUsers === 0) {
      throw new ForbiddenException(
        `Your ${plan} plan does not include staff accounts. Upgrade to add team members.`,
      );
    }

    const count = await this.prisma.user.count({
      where: { tenantId, role: 'STAFF', isActive: true },
    });

    if (count >= limits.maxStaffUsers) {
      throw new ForbiddenException(
        `Your ${plan} plan allows up to ${limits.maxStaffUsers} staff members. ` +
        `Upgrade to add more.`,
      );
    }
  }

  // ── Check monthly order limit ──────────────────────────────────────────────
  async assertCanPlaceOrder(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = getPlan(plan).limits;

    if (limits.maxOrdersPerMonth === -1) return;

    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const count = await this.prisma.order.count({
      where: { tenantId, createdAt: { gte: start } },
    });

    if (count >= limits.maxOrdersPerMonth) {
      throw new ForbiddenException(
        `Your store has reached its ${limits.maxOrdersPerMonth} order limit for this month. ` +
        `Upgrade your plan to continue receiving orders.`,
      );
    }
  }

  // ── Check variant access ───────────────────────────────────────────────────
  async assertVariantsEnabled(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = getPlan(plan).limits;

    if (!limits.variantsEnabled) {
      throw new ForbiddenException(
        `Product variants are not available on the ${plan} plan. Upgrade to use this feature.`,
      );
    }
  }

  // ── Check reports access ───────────────────────────────────────────────────
  async assertReportsEnabled(tenantId: string): Promise<void> {
    const plan = await this.getTenantPlan(tenantId);
    const limits = getPlan(plan).limits;

    if (!limits.reportsEnabled) {
      throw new ForbiddenException(
        `Reports are not available on the ${plan} plan. Upgrade to access them.`,
      );
    }
  }

  // ── Internal helpers ───────────────────────────────────────────────────────
  private async getTenantPlan(tenantId: string): Promise<PlanId> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    return (tenant?.plan ?? 'free') as PlanId;
  }
}
