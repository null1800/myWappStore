import {
  Controller, Get, Patch, Param, Query,
  Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';

@Controller({ path: 'customers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(
    @Tenant() tenant: TenantContext,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll(tenant.id, +page, +limit, search);
  }

  @Get(':id')
  findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.findOne(tenant.id, id);
  }

  @Patch(':id/notes')
  updateNotes(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes: string,
  ) {
    return this.customersService.updateNotes(tenant.id, id, notes);
  }
}
