import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';

@Controller({ path: 'categories', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(tenant.id, dto);
  }

  @Get()
  findAll(@Tenant() tenant: TenantContext) {
    return this.categoriesService.findAll(tenant.id);
  }

  @Patch(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  remove(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoriesService.remove(tenant.id, id);
  }
}
