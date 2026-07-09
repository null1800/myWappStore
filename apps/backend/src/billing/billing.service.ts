import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaystackProvider } from './providers/paystack.provider';
import { PLANS, getPlan, type PlanId } from './plans';
import { randomUUID } from 'node:crypto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackProvider,
    private readonly config: ConfigService,
  ) {}

  // ── GET current subscription ───────────────────────────────────────────────
  async getSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, email: true, name: true },
    });

    const plan = getPlan(tenant?.plan ?? 'free');
    const allPlans = Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      highlighted: p.highlighted,
      priceMonthlyzMW: p.priceTambalaMonthly / 100,
      priceYearlyZMW: p.priceTambalaYearly / 100,
      limits: p.limits,
    }));

    return {
      currentPlan: plan.id,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            trialEndsAt: subscription.trialEndsAt,
            cancelledAt: subscription.cancelledAt,
          }
        : null,
      plans: allPlans,
      paystackConfigured: this.paystack.isConfigured,
    };
  }

  // ── INITIATE upgrade/checkout ──────────────────────────────────────────────
  // Returns a Paystack authorization URL to redirect the user to.
  async initiateUpgrade(tenantId: string, targetPlan: PlanId, billingCycle: 'monthly' | 'yearly') {
    const current = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, email: true },
    });

    if (!current) throw new NotFoundException('Tenant not found.');
    if (current.plan === targetPlan) {
      throw new BadRequestException(`You are already on the ${targetPlan} plan.`);
    }
    if (targetPlan === 'free') {
      throw new BadRequestException('To downgrade to free, use the cancel subscription endpoint.');
    }

    const plan = PLANS[targetPlan];
    if (!plan) throw new BadRequestException(`Unknown plan: ${targetPlan}`);

    const amountTambala = billingCycle === 'yearly'
      ? plan.priceTambalaYearly
      : plan.priceTambalaMonthly;

    const reference = `mwas-${tenantId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    const callbackUrl = `${this.config.get('FRONTEND_URL')}/dashboard/billing/verify?ref=${reference}`;

    const result = await this.paystack.initiatePayment({
      amountTambala,
      currency: 'ZMW',
      email: current.email,
      reference,
      metadata: { tenantId, targetPlan, billingCycle },
      callbackUrl,
    });

    // Record a pending transaction immediately — if the user abandons the
    // payment flow, we have a record of the attempt
    await this.prisma.paymentTransaction.create({
      data: {
        tenantId,
        provider: 'paystack',
        providerRef: reference,
        type: 'subscription',
        plan: targetPlan,
        amountKobo: amountTambala,
        currency: 'ZMW',
        status: 'pending',
        metadata: { billingCycle },
      },
    });

    return { authorizationUrl: result.authorizationUrl, reference };
  }

  // ── VERIFY payment after Paystack redirect ─────────────────────────────────
  async verifyUpgrade(tenantId: string, reference: string) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { providerRef: reference, tenantId },
    });

    if (!transaction) throw new NotFoundException('Transaction not found.');
    if (transaction.status === 'success') {
      return { success: true, message: 'Payment already verified.' };
    }

    const verification = await this.paystack.verifyPayment(reference);

    if (!verification.success) {
      await this.prisma.paymentTransaction.updateMany({
        where: { providerRef: reference, tenantId },
        data: { status: 'failed' },
      });
      throw new BadRequestException('Payment was not successful. Please try again.');
    }

    const metadata = transaction.metadata as Record<string, unknown>;
    const targetPlan = (metadata?.billingCycle === 'yearly'
      ? transaction.plan
      : transaction.plan) as PlanId;
    const billingCycle = (metadata?.billingCycle ?? 'monthly') as 'monthly' | 'yearly';

    await this.activatePlan(tenantId, targetPlan, billingCycle, reference);

    await this.prisma.paymentTransaction.updateMany({
      where: { providerRef: reference, tenantId },
      data: { status: 'success', providerRef: verification.providerRef },
    });

    return { success: true, plan: targetPlan };
  }

  // ── HANDLE Paystack webhook ────────────────────────────────────────────────
  // Called by the /billing/webhook endpoint (raw body, no JSON parsing).
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.paystack.validateWebhook(rawBody, signature)) {
      this.logger.warn('Paystack webhook signature validation failed');
      return; // silently ignore — don't throw (Paystack retries on 4xx)
    }

    const { event, data } = this.paystack.parseWebhookEvent(rawBody);
    this.logger.log(`Paystack webhook received: ${event}`);

    switch (event) {
      case 'charge.success': {
        const meta = (data.metadata as Record<string, unknown>) ?? {};
        const tenantId = meta.tenantId as string | undefined;
        const targetPlan = meta.targetPlan as PlanId | undefined;
        const billingCycle = (meta.billingCycle ?? 'monthly') as 'monthly' | 'yearly';
        const reference = data.reference as string;

        if (!tenantId || !targetPlan) {
          this.logger.warn(`charge.success missing metadata: ${JSON.stringify(meta)}`);
          break;
        }

        // Idempotent — activatePlan checks if subscription is already current
        await this.activatePlan(tenantId, targetPlan, billingCycle, reference);
        await this.prisma.paymentTransaction.updateMany({
          where: { providerRef: reference },
          data: { status: 'success' },
        });
        break;
      }

      case 'subscription.disable': {
        const tenantId = ((data.metadata as Record<string, unknown>)?.tenantId) as string | undefined;
        if (tenantId) await this.expireSubscription(tenantId);
        break;
      }

      default:
        this.logger.debug(`Unhandled Paystack event: ${event}`);
    }
  }

  // ── CANCEL subscription ────────────────────────────────────────────────────
  async cancelSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub || sub.plan === 'free') {
      throw new BadRequestException('No active paid subscription to cancel.');
    }
    if (sub.cancelledAt) {
      throw new BadRequestException('Subscription is already cancelled.');
    }

    // Mark as cancelled — they keep access until period end, then expire
    await this.prisma.subscription.update({
      where: { tenantId },
      data: { cancelledAt: new Date() },
    });

    this.logger.log(`Subscription cancelled for tenant ${tenantId} — access until ${sub.currentPeriodEnd.toISOString()}`);

    return {
      message: 'Your subscription has been cancelled. You will keep access until the end of your billing period.',
      accessUntil: sub.currentPeriodEnd,
    };
  }

  // ── BILLING history ────────────────────────────────────────────────────────
  async getBillingHistory(tenantId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: { tenantId, status: 'success' },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true,
        provider: true,
        plan: true,
        amountKobo: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });
  }

  // ── Internal: activate a plan after verified payment ──────────────────────
  private async activatePlan(
    tenantId: string,
    plan: PlanId,
    billingCycle: 'monthly' | 'yearly',
    reference: string,
  ) {
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.$transaction([
      // Update or create subscription row
      this.prisma.subscription.upsert({
        where: { tenantId },
        update: {
          plan,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
        },
        create: {
          tenantId,
          plan,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      }),
      // Sync plan onto the tenant row for quick reads
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan },
      }),
    ]);

    this.logger.log(`Plan activated: tenant ${tenantId} → ${plan} (${billingCycle}) via ${reference}`);
  }

  // ── Internal: downgrade to free when subscription expires/is disabled ─────
  private async expireSubscription(tenantId: string) {
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { tenantId },
        data: { plan: 'free', status: 'expired' },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: 'free' },
      }),
    ]);

    this.logger.log(`Subscription expired for tenant ${tenantId} — downgraded to free`);
  }
}
