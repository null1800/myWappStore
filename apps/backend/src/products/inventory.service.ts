import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DeductStockOptions {
  productId: string;
  variantId?: string;       // if set, deduct from variant stock instead of product stock
  tenantId: string;
  quantity: number;
  orderId: string;          // reference for audit log
  allowBackorder: boolean;
  tx?: any;                 // optional Prisma transaction context
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Manual stock adjustment (merchant action) ──────────────────────────────
  async adjustStock(
    productId: string,
    tenantId: string,
    changeQty: number,
    reason: string,
    note: string | undefined,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Get current stock
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true, stockQuantity: true, trackInventory: true, name: true },
      });

      if (!product) {
        throw new BadRequestException('Product not found.');
      }

      const newQty = product.stockQuantity + changeQty;

      if (newQty < 0) {
        throw new BadRequestException(
          `Cannot remove ${Math.abs(changeQty)} units — only ${product.stockQuantity} in stock.`,
        );
      }

      // Update stock quantity
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: newQty },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          status: true,
        },
      });

      // Write immutable audit log entry
      await tx.inventoryLog.create({
        data: {
          productId,
          tenantId,
          changeQty,
          reason,
          note: note ?? null,
          createdById: userId,
        },
      });

      this.logger.log(
        `Stock adjusted: ${product.name} | ${changeQty > 0 ? '+' : ''}${changeQty} | new qty: ${newQty} | reason: ${reason}`,
      );

      return updated;
    });
  }

  // ── Deduct stock when order is placed ─────────────────────────────────────
  // Called from OrdersService inside an existing transaction.
  //
  // This used to be read-then-write (findFirst → compute newQty → update),
  // which races: under concurrent checkout, two requests can both read the
  // same stockQuantity, both pass the stock check, and the second write
  // silently overwrites the first — a lost update that can oversell stock.
  //
  // Fixed by doing the check-and-decrement as a single atomic UPDATE
  // statement. Postgres evaluates the WHERE clause against the row at the
  // moment of the write, so a losing concurrent request simply matches zero
  // rows instead of corrupting the count.
  async deductStockForOrder(options: DeductStockOptions) {
    const { productId, variantId, tenantId, quantity, orderId, allowBackorder, tx } = options;
    const client = tx ?? this.prisma;

    // ── Variant-level deduction ────────────────────────────────────────────
    if (variantId) {
      const backorderAllowed = allowBackorder;

      if (backorderAllowed) {
        await client.$executeRaw`
          UPDATE "product_variants"
          SET "stock_quantity" = GREATEST("stock_quantity" - ${quantity}, 0)
          WHERE "id" = ${variantId}::uuid AND "tenant_id" = ${tenantId}::uuid
        `;
      } else {
        const result = await client.productVariant.updateMany({
          where: { id: variantId, tenantId, stockQuantity: { gte: quantity } },
          data: { stockQuantity: { decrement: quantity } },
        });

        if (result.count === 0) {
          const current = await client.productVariant.findFirst({
            where: { id: variantId, tenantId },
            select: { stockQuantity: true, name: true },
          });
          throw new BadRequestException(
            `"${current?.name ?? 'Variant'}" is out of stock. Only ${current?.stockQuantity ?? 0} available.`,
          );
        }
      }

      await client.inventoryLog.create({
        data: {
          productId,
          variantId,
          tenantId,
          changeQty: -quantity,
          reason: 'order',
          referenceId: orderId,
          note: 'Deducted for order',
        },
      });

      return;
    }

    // ── Product-level deduction (no variant) ──────────────────────────────
    const product = await client.product.findFirst({
      where: { id: productId, tenantId },
      select: { trackInventory: true, name: true, allowBackorder: true },
    });

    if (!product) {
      throw new BadRequestException(`Product not found: ${productId}`);
    }

    // Skip stock check if inventory tracking is disabled for this product
    if (!product.trackInventory) return;

    const backorderAllowed = allowBackorder || product.allowBackorder;

    if (backorderAllowed) {
      // Backorder allowed — still atomic, and clamps at 0 (matches prior
      // behavior of not tracking negative stock) via a single UPDATE.
      await client.$executeRaw`
        UPDATE "products"
        SET "stock_quantity" = GREATEST("stock_quantity" - ${quantity}, 0)
        WHERE "id" = ${productId}::uuid AND "tenant_id" = ${tenantId}::uuid
      `;
    } else {
      // No backorder — the WHERE clause only matches if enough stock
      // remains *at write time*, so a losing concurrent request gets
      // count === 0 instead of an oversold negative balance.
      const result = await client.product.updateMany({
        where: {
          id: productId,
          tenantId,
          stockQuantity: { gte: quantity },
        },
        data: { stockQuantity: { decrement: quantity } },
      });

      if (result.count === 0) {
        // Stock changed between our earlier validation and now (lost the
        // race to a concurrent order) — re-check for an accurate message.
        const current = await client.product.findFirst({
          where: { id: productId, tenantId },
          select: { stockQuantity: true },
        });
        throw new BadRequestException(
          `"${product.name}" is out of stock. Only ${current?.stockQuantity ?? 0} available.`,
        );
      }
    }

    await client.inventoryLog.create({
      data: {
        productId,
        tenantId,
        changeQty: -quantity,
        reason: 'order',
        referenceId: orderId,
        note: `Deducted for order`,
      },
    });
  }

  // ── Get inventory history for a product ───────────────────────────────────
  async getInventoryHistory(
    productId: string,
    tenantId: string,
    page = 1,
    limit = 20,
  ) {
    const { skip, take } = this.prisma.getPaginationParams(page, limit);

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.inventoryLog.findMany({
        where: { productId, tenantId },
        select: {
          id: true,
          changeQty: true,
          reason: true,
          referenceId: true,
          note: true,
          createdAt: true,
          createdBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.inventoryLog.count({ where: { productId, tenantId } }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ── Get low stock products for a tenant ───────────────────────────────────
  async getLowStockProducts(tenantId: string, threshold = 5) {
    return this.prisma.product.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        trackInventory: true,
        stockQuantity: { lte: threshold },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        images: true,
        category: { select: { name: true } },
      },
      orderBy: { stockQuantity: 'asc' },
    });
  }
}
