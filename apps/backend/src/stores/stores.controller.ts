import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { UpdateStoreDto, UpdateSlugDto } from './dto/store.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';

// All routes: /api/v1/stores/...
@Controller({ path: 'stores', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // ── Merchant routes (protected) ───────────────────────────────────────────

  // GET /api/v1/stores/me
  @Get('me')
  getMyStore(@Tenant() tenant: TenantContext) {
    return this.storesService.getMyStore(tenant.id);
  }

  // PATCH /api/v1/stores/me
  @Patch('me')
  @Roles('OWNER') // only store owners can update settings
  updateMyStore(
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.updateMyStore(tenant.id, dto);
  }

  // PATCH /api/v1/stores/me/slug
  // Separate from general update — changing slug is a significant action
  @Patch('me/slug')
  @Roles('OWNER')
  updateSlug(
    @Tenant() tenant: TenantContext,
    @Body() dto: UpdateSlugDto,
  ) {
    return this.storesService.updateSlug(tenant.id, dto);
  }

  // POST /api/v1/stores/me/logo
  @Post('me/logo')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  updateLogo(
    @Tenant() tenant: TenantContext,
    @Body('url') url: string,
  ) {
    return this.storesService.updateStoreImage(tenant.id, 'logoUrl', url);
  }

  // POST /api/v1/stores/me/banner
  @Post('me/banner')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  updateBanner(
    @Tenant() tenant: TenantContext,
    @Body('url') url: string,
  ) {
    return this.storesService.updateStoreImage(tenant.id, 'bannerUrl', url);
  }

  // ── Public routes (no auth required) ─────────────────────────────────────

  // GET /api/v1/stores/check-slug?slug=rays-electronics
  // Used during registration and slug-change UI for live availability check
  @Public()
  @Get('check-slug')
  checkSlug(
    @Query('slug') slug: string,
    @Query('exclude') excludeId?: string,
  ) {
    return this.storesService.checkSlugAvailability(slug, excludeId);
  }

  // GET /api/v1/stores?page=1&limit=20&search=electronics
  // Marketplace store discovery
  @Public()
  @Get()
  listPublicStores(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.storesService.listPublicStores(+page, +limit, search);
  }

  // GET /api/v1/stores/:slug
  // Public storefront — called by Next.js SSR on every storefront page load
  @Public()
  @Get(':slug')
  getPublicStore(@Param('slug') slug: string) {
    return this.storesService.getPublicStore(slug);
  }

  // GET /api/v1/stores/:slug/products?page=1&limit=20&categoryId=...
  // Public product listing for storefront
  @Public()
  @Get(':slug/products')
  getStoreProducts(
    @Param('slug') slug: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.storesService.getPublicStoreProducts(
      slug,
      +page,
      +limit,
      categoryId,
    );
  }

  // GET /api/v1/stores/:slug/categories
  // Public categories for storefront filter nav
  @Public()
  @Get(':slug/categories')
  getStoreCategories(@Param('slug') slug: string) {
    return this.storesService.getPublicStoreCategories(slug);
  }
}
