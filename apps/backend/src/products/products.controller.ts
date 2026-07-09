import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductVariantsService } from './product-variants.service';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustStockDto,
  ProductQueryDto,
} from './dto/product.dto';
import { UpdateImagesDto } from './dto/update-images.dto';
import { CreateVariantDto, UpdateVariantDto } from './dto/variants/variant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';

// All routes: /api/v1/products/...
@Controller({ path: 'products', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly variantsService: ProductVariantsService,
  ) {}

  // POST /api/v1/products
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(tenant.id, dto);
  }

  // GET /api/v1/products?status=ACTIVE&page=1&limit=20&search=iphone
  @Get()
  findAll(
    @Tenant() tenant: TenantContext,
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findAll(tenant.id, query);
  }

  // GET /api/v1/products/low-stock
  // Must be declared BEFORE :id to avoid route conflict
  @Get('low-stock')
  getLowStock(@Tenant() tenant: TenantContext) {
    return this.productsService.getLowStock(tenant.id);
  }

  // GET /api/v1/products/:id
  @Get(':id')
  findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.findOne(tenant.id, id);
  }

  // PATCH /api/v1/products/:id
  @Patch(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(tenant.id, id, dto);
  }

  // DELETE /api/v1/products/:id  (soft delete → archived)
  @Delete(':id')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  archive(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.archive(tenant.id, id);
  }

  // PATCH /api/v1/products/:id/stock
  @Patch(':id/stock')
  adjustStock(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.productsService.adjustStock(tenant.id, id, dto, tenant.userId);
  }

  // GET /api/v1/products/:id/inventory
  @Get(':id/inventory')
  getInventoryHistory(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.productsService.getInventoryHistory(tenant.id, id, +page, +limit);
  }

  // PATCH /api/v1/products/:id/images
  // Called after frontend uploads images directly to Supabase Storage.
  // URLs are validated to prevent XSS via javascript:/data: URI injection.
  @Patch(':id/images')
  updateImages(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImagesDto,
  ) {
    return this.productsService.updateImages(tenant.id, id, dto.images);
  }

  // ── Variant routes: /api/v1/products/:id/variants ─────────────────────────

  // GET /api/v1/products/:id/variants
  @Get(':id/variants')
  listVariants(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.variantsService.findAll(tenant.id, id);
  }

  // POST /api/v1/products/:id/variants
  @Post(':id/variants')
  @HttpCode(HttpStatus.CREATED)
  createVariant(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.variantsService.create(tenant.id, id, dto);
  }

  // PATCH /api/v1/products/:id/variants/:variantId
  @Patch(':id/variants/:variantId')
  updateVariant(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantsService.update(tenant.id, id, variantId, dto);
  }

  // DELETE /api/v1/products/:id/variants/:variantId
  @Delete(':id/variants/:variantId')
  @HttpCode(HttpStatus.OK)
  removeVariant(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.variantsService.remove(tenant.id, id, variantId);
  }

  // PATCH /api/v1/products/:id/variants/:variantId/stock
  @Patch(':id/variants/:variantId/stock')
  adjustVariantStock(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: { type: 'set' | 'increment' | 'decrement'; quantity: number; note?: string },
  ) {
    return this.variantsService.adjustStock(tenant.id, id, variantId, body);
  }
}

