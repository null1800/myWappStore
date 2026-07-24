import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InProcessCacheService } from '../common/cache/cache.service';
import { UpdateStoreDto, UpdateSlugDto } from './dto/store.dto';

// Fields returned on the public storefront — no sensitive data
const PUBLIC_STORE_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  primaryColor: true,
  phoneWhatsapp: true,
  isPublic: true,
  isActive: true,
  theme: true,
  headline: true,
  subtitle: true,
  aboutText: true,
  address: true,
  contactEmail: true,
  facebookUrl: true,
  instagramUrl: true,
  businessType: true,
  enabledModules: true,
  createdAt: true,
} as const;

// Fields returned to the authenticated merchant
const MERCHANT_STORE_SELECT = {
  id: true,
  slug: true,
  name: true,
  email: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  primaryColor: true,
  phoneWhatsapp: true,
  isPublic: true,
  isActive: true,
  theme: true,
  headline: true,
  subtitle: true,
  aboutText: true,
  address: true,
  contactEmail: true,
  facebookUrl: true,
  instagramUrl: true,
  plan: true,
  businessType: true,
  businessTypeUpdatedAt: true,
  enabledModules: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: InProcessCacheService,
  ) {}

  // ── GET /stores/me ─────────────────────────────────────────────────────────
  // Returns the authenticated merchant's store profile
  async getMyStore(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: MERCHANT_STORE_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException('Store not found.');
    }

    return tenant;
  }

  // ── PATCH /stores/me ───────────────────────────────────────────────────────
  // Updates store settings — only fields provided in the body
  async updateMyStore(tenantId: string, dto: UpdateStoreDto) {
    const currentStore = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true, businessTypeUpdatedAt: true, enabledModules: true },
    });

    if (!currentStore) {
      throw new NotFoundException('Store not found.');
    }

    const dataToUpdate: any = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.phoneWhatsapp !== undefined && { phoneWhatsapp: dto.phoneWhatsapp }),
      ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.theme !== undefined && { theme: dto.theme }),
      ...(dto.headline !== undefined && { headline: dto.headline }),
      ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
      ...(dto.aboutText !== undefined && { aboutText: dto.aboutText }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
      ...(dto.facebookUrl !== undefined && { facebookUrl: dto.facebookUrl }),
      ...(dto.instagramUrl !== undefined && { instagramUrl: dto.instagramUrl }),
      ...(dto.enabledModules !== undefined && { enabledModules: dto.enabledModules }),
    };

    if (dto.businessType !== undefined && dto.businessType !== currentStore.businessType) {
      if (currentStore.businessTypeUpdatedAt) {
        const diffMs = Date.now() - new Date(currentStore.businessTypeUpdatedAt).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays < 30) {
          const remainingDays = Math.ceil(30 - diffDays);
          throw new ConflictException(
            `Primary Business Type is locked and cannot be changed for another ${remainingDays} days.`
          );
        }
      }
      dataToUpdate.businessType = dto.businessType;
      dataToUpdate.businessTypeUpdatedAt = new Date();
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: dataToUpdate,
      select: MERCHANT_STORE_SELECT,
    });

    if (dto.businessType !== undefined || dto.enabledModules !== undefined) {
      await this.autoConfigureCategories(tenantId, tenant.businessType, tenant.enabledModules);
    }

    // Invalidate public storefront cache so changes are visible immediately
    this.cache.invalidate(`store:${tenant.slug}`);
    this.logger.log(`Store updated: ${tenantId}`);
    return tenant;
  }

  private async autoConfigureCategories(tenantId: string, businessType: string, enabledModules: string[] = []) {
    const modulesToCheck = [businessType, ...enabledModules];
    const defaultCategoriesMap: Record<string, string[]> = {
      RESTAURANT: ['Beverages', 'Main Dishes', 'Sides & Desserts'],
      CLOTHING: ['Men\'s Fashion', 'Women\'s Fashion', 'Accessories'],
      RETAIL: ['Best Sellers', 'New Arrivals'],
      GROCERY: ['Fresh Produce', 'Pantry', 'Beverages & Snacks'],
      PHARMACY: ['Over-The-Counter', 'Personal Care', 'Vitamins & Supplements'],
      ELECTRONICS: ['Smartphones & Accessories', 'Computers & Laptops', 'Audio & Gadgets'],
      SERVICE: ['Consultation', 'Standard Service', 'Express Service'],
    };

    const categoriesToCreate: string[] = [];
    for (const mod of modulesToCheck) {
      const cats = defaultCategoriesMap[mod.toUpperCase()];
      if (cats) {
        categoriesToCreate.push(...cats);
      }
    }

    // Filter duplicates
    const uniqueCats = Array.from(new Set(categoriesToCreate));

    if (uniqueCats.length === 0) return;

    // Fetch existing categories to avoid duplicates
    const existing = await this.prisma.category.findMany({
      where: { tenantId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map(c => c.name.toLowerCase()));

    const toInsert = uniqueCats.filter(name => !existingNames.has(name.toLowerCase()));

    for (const catName of toInsert) {
      const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await this.prisma.category.create({
        data: {
          tenantId,
          name: catName,
          slug,
          isActive: true,
        }
      }).catch(err => this.logger.error(`Failed to auto-create category ${catName}: ${err.message}`));
    }
  }

  // ── PATCH /stores/me/slug ──────────────────────────────────────────────────
  async updateSlug(tenantId: string, dto: UpdateSlugDto) {
    const existing = await this.prisma.tenant.findFirst({
      where: { slug: dto.slug, NOT: { id: tenantId } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`The store URL "${dto.slug}" is already taken.`);
    }

    // Fetch old slug to invalidate its cache before updating
    const oldTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { slug: dto.slug },
      select: MERCHANT_STORE_SELECT,
    });

    // Invalidate both old and new slug in case of partial cache hits
    if (oldTenant) this.cache.invalidate(`store:${oldTenant.slug}`);
    this.cache.invalidate(`store:${dto.slug}`);

    this.logger.log(`Slug updated for tenant ${tenantId}: ${dto.slug}`);
    return tenant;
  }

  // ── GET /stores/check-slug ─────────────────────────────────────────────────
  // Checks if a slug is available — used in registration and slug change UI
  async checkSlugAvailability(
    slug: string,
    excludeTenantId?: string,
  ): Promise<{ available: boolean; slug: string }> {
    const existing = await this.prisma.tenant.findFirst({
      where: {
        slug,
        ...(excludeTenantId && { NOT: { id: excludeTenantId } }),
      },
      select: { id: true },
    });

    return { available: !existing, slug };
  }

  // ── GET /stores/:slug (public) ─────────────────────────────────────────────
  async getPublicStore(slug: string) {
    const cacheKey = `store:${slug}`;
    const cached = this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: PUBLIC_STORE_SELECT,
    });

    if (!tenant) throw new NotFoundException(`Store "${slug}" not found.`);

    this.cache.set(cacheKey, tenant);
    return tenant;
  }

  // ── GET /stores/:slug/products (public) ────────────────────────────────────
  // Returns active products for a storefront — paginated
  // Used by Next.js SSR — no auth required
  async getPublicStoreProducts(
    slug: string,
    page = 1,
    limit = 20,
    categoryId?: string,
  ) {
    // First resolve the store to get tenantId
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(`Store "${slug}" not found.`);
    }

    const { skip, take } = this.prisma.getPaginationParams(page, limit);

    const where = {
      tenantId: tenant.id,
      status: 'ACTIVE' as const,
      ...(categoryId && { categoryId }),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          compareAtPrice: true,
          images: true,
          stockQuantity: true,
          allowBackorder: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
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

  // ── GET /stores/:slug/categories (public) ──────────────────────────────────
  async getPublicStoreCategories(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(`Store "${slug}" not found.`);
    }

    return this.prisma.category.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── GET /stores (marketplace) ──────────────────────────────────────────────
  // Lists public stores — used by marketplace discovery page
  // No auth required
  async listPublicStores(page = 1, limit = 20, search?: string) {
    const { skip, take } = this.prisma.getPaginationParams(page, limit);

    const where = {
      isPublic: true,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [stores, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        select: {
          ...PUBLIC_STORE_SELECT,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: stores,
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ── POST /stores/me/logo (upload) ──────────────────────────────────────────
  // Updates logo/banner URL after file is uploaded to Supabase Storage
  // The actual upload happens client-side direct to Supabase Storage
  // This endpoint just saves the resulting URL
  async updateStoreImage(
    tenantId: string,
    field: 'logoUrl' | 'bannerUrl',
    url: string,
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { [field]: url },
      select: { id: true, logoUrl: true, bannerUrl: true },
    });
  }
}
