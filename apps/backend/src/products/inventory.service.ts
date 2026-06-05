import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DeductStockOptions {
  productId: string;
  tenantId: string;
  quantity: number;
  orderId: string;        // reference for audit log
  allowBackorder: boolean;
  tx?: any;              // optional Prisma transaction context
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
  // Called from OrdersService inside an existing transaction
  async deductStockForOrder(options: DeductStockOptions) {
    const { productId, tenantId, quantity, orderId, allowBackorder, tx } = options;
    const client = tx ?? this.prisma;

    const product = await client.product.findFirst({
      where: { id: productId, tenantId },
      select: { stockQuantity: true, trackInventory: true, name: true, allowBackorder: true },
    });

    if (!product) {
      throw new BadRequestException(`Product not found: ${productId}`);
    }

    // Skip stock check if inventory tracking is disabled for this product
    if (!product.trackInventory) return;

    const newQty = product.stockQuantity - quantity;

    if (newQty < 0 && !allowBackorder && !product.allowBackorder) {
      throw new BadRequestException(
        `"${product.name}" is out of stock. Only ${product.stockQuantity} available.`,
      );
    }

    await client.product.update({
      where: { id: productId },
      data: { stockQuantity: Math.max(0, newQty) },
    });

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
