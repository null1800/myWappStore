import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustStockDto,
  ProductQueryDto,
} from './dto/product.dto';
import { generateSlug, makeSlugUnique } from './utils/slug.util';

// Fields returned in list views — lighter payload
const PRODUCT_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  sku: true,
  stockQuantity: true,
  status: true,
  images: true,
  trackInventory: true,
  allowBackorder: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
} as const;

// Full fields for detail view
const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_LIST_SELECT,
  description: true,
  tags: true,
  weightGrams: true,
  metaTitle: true,
  metaDescription: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  // ── CREATE ─────────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateProductDto) {
    // Generate slug from name if not provided
    const baseSlug = dto.slug ?? generateSlug(dto.name);

    // Ensure slug is unique within this tenant's product catalogue
    const slug = await makeSlugUnique(baseSlug, async (s) => {
      const existing = await this.prisma.product.findFirst({
        where: { tenantId, slug: s },
        select: { id: true },
      });
      return !!existing;
    });

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        slug,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice ?? null,
        sku: dto.sku ?? null,
        stockQuantity: dto.stockQuantity ?? 0,
        trackInventory: dto.trackInventory ?? true,
        allowBackorder: dto.allowBackorder ?? false,
        status: dto.status ?? 'DRAFT', // default to DRAFT — merchant publishes deliberately
        categoryId: dto.categoryId ?? null,
        images: dto.images ?? [],
        tags: dto.tags ?? [],
        weightGrams: dto.weightGrams ?? null,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    this.logger.log(`Product created: ${product.name} [${tenantId}]`);
    return product;
  }

  // ── LIST (dashboard) ───────────────────────────────────────────────────────
  async findAll(tenantId: string, query: ProductQueryDto) {
    const { page = 1, limit = 20, status, categoryId, search, lowStock } = query;
    const { skip, take } = this.prisma.getPaginationParams(page, limit);

    const where = {
      tenantId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(lowStock && { stockQuantity: { lte: 5 }, trackInventory: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ── FIND ONE ───────────────────────────────────────────────────────────────
  async findOne(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: PRODUCT_DETAIL_SELECT,
    });

    if (!product) {
      throw new NotFoundException(`Product not found.`);
    }

    return product;
  }

  // ── FIND BY SLUG (public storefront) ───────────────────────────────────────
  async findBySlug(tenantId: string, slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { tenantId, slug, status: 'ACTIVE' },
      select: PRODUCT_DETAIL_SELECT,
    });

    if (!product) {
      throw new NotFoundException(`Product not found.`);
    }

    return product;
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  async update(tenantId: string, productId: string, dto: UpdateProductDto) {
    // Confirm product belongs to this tenant
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Product not found.`);
    }

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.compareAtPrice !== undefined && { compareAtPrice: dto.compareAtPrice }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.trackInventory !== undefined && { trackInventory: dto.trackInventory }),
        ...(dto.allowBackorder !== undefined && { allowBackorder: dto.allowBackorder }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.images !== undefined && { images: dto.images }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.weightGrams !== undefined && { weightGrams: dto.weightGrams }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    return product;
  }

  // ── ARCHIVE (soft delete) ──────────────────────────────────────────────────
  // We never hard-delete products — they may be referenced by existing orders
  async archive(tenantId: string, productId: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException(`Product not found.`);
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED' },
    });

    this.logger.log(`Product archived: ${existing.name} [${tenantId}]`);
    return { message: `"${existing.name}" has been archived.` };
  }

  // ── STOCK ADJUST ───────────────────────────────────────────────────────────
  async adjustStock(
    tenantId: string,
    productId: string,
    dto: AdjustStockDto,
    userId: string,
  ) {
    // Verify product belongs to tenant before adjusting
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return this.inventory.adjustStock(
      productId,
      tenantId,
      dto.changeQty,
      dto.reason,
      dto.note,
      userId,
    );
  }

  // ── INVENTORY HISTORY ──────────────────────────────────────────────────────
  async getInventoryHistory(
    tenantId: string,
    productId: string,
    page: number,
    limit: number,
  ) {
    // Verify ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return this.inventory.getInventoryHistory(productId, tenantId, page, limit);
  }

  // ── LOW STOCK ALERT LIST ───────────────────────────────────────────────────
  async getLowStock(tenantId: string) {
    return this.inventory.getLowStockProducts(tenantId);
  }

  // ── BULK IMAGE UPDATE ──────────────────────────────────────────────────────
  // Called after images are uploaded directly to Supabase Storage from frontend
  async updateImages(tenantId: string, productId: string, imageUrls: string[]) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found.');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { images: imageUrls },
      select: { id: true, images: true },
    });
  }
}
