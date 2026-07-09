import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/variants/variant.dto';

@Injectable()
export class ProductVariantsService {
  private readonly logger = new Logger(ProductVariantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── LIST variants for a product ────────────────────────────────────────────
  async findAll(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, hasVariants: true },
    });

    if (!product) throw new NotFoundException('Product not found.');

    return this.prisma.productVariant.findMany({
      where: { productId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── CREATE variant ─────────────────────────────────────────────────────────
  async create(tenantId: string, productId: string, dto: CreateVariantDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });

    if (!product) throw new NotFoundException('Product not found.');

    // Mark product as having variants in the same transaction
    const [variant] = await this.prisma.$transaction([
      this.prisma.productVariant.create({
        data: {
          tenantId,
          productId,
          name: dto.name,
          options: dto.options,
          sku: dto.sku,
          priceOverride: dto.priceOverride ?? null,
          stockQuantity: dto.stockQuantity ?? 0,
          isActive: dto.isActive ?? true,
        },
      }),
      this.prisma.product.update({
        where: { id: productId },
        data: { hasVariants: true },
      }),
    ]);

    return variant;
  }

  // ── UPDATE variant ─────────────────────────────────────────────────────────
  async update(
    tenantId: string,
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ) {
    // Confirm variant belongs to this tenant + product before writing
    const existing = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Variant not found.');

    const result = await this.prisma.productVariant.updateMany({
      where: { id: variantId, productId, tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.options !== undefined && { options: dto.options }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.priceOverride !== undefined && { priceOverride: dto.priceOverride }),
        ...(dto.stockQuantity !== undefined && { stockQuantity: dto.stockQuantity }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (result.count === 0) throw new NotFoundException('Variant not found.');

    return this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
    });
  }

  // ── DELETE variant ─────────────────────────────────────────────────────────
  async remove(tenantId: string, productId: string, variantId: string) {
    const result = await this.prisma.productVariant.deleteMany({
      where: { id: variantId, productId, tenantId },
    });

    if (result.count === 0) throw new NotFoundException('Variant not found.');

    // If no more variants, remove the hasVariants flag
    const remaining = await this.prisma.productVariant.count({
      where: { productId, tenantId },
    });

    if (remaining === 0) {
      await this.prisma.product.updateMany({
        where: { id: productId, tenantId },
        data: { hasVariants: false },
      });
    }

    return { message: 'Variant deleted.' };
  }

  // ── ADJUST stock ───────────────────────────────────────────────────────────
  // Supports both absolute set and relative increment/decrement
  async adjustStock(
    tenantId: string,
    productId: string,
    variantId: string,
    adjustment: { type: 'set' | 'increment' | 'decrement'; quantity: number; note?: string },
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
      select: { id: true, stockQuantity: true },
    });

    if (!variant) throw new NotFoundException('Variant not found.');

    let newQty: number;
    let changeQty: number;

    if (adjustment.type === 'set') {
      if (adjustment.quantity < 0) throw new BadRequestException('Stock cannot be negative.');
      newQty = adjustment.quantity;
      changeQty = adjustment.quantity - variant.stockQuantity;
    } else if (adjustment.type === 'increment') {
      newQty = variant.stockQuantity + adjustment.quantity;
      changeQty = adjustment.quantity;
    } else {
      newQty = Math.max(0, variant.stockQuantity - adjustment.quantity);
      changeQty = -(variant.stockQuantity - newQty);
    }

    await this.prisma.$transaction([
      this.prisma.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newQty },
      }),
      this.prisma.inventoryLog.create({
        data: {
          productId,
          variantId,
          tenantId,
          changeQty,
          reason: 'adjustment',
          note: adjustment.note ?? `Manual stock ${adjustment.type}`,
        },
      }),
    ]);

    this.logger.log(`Variant ${variantId} stock adjusted: ${variant.stockQuantity} → ${newQty}`);

    return { variantId, previousStock: variant.stockQuantity, newStock: newQty };
  }
}
