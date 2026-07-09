import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';

type Period = '7d' | '30d' | '90d' | 'all';
const VALID_PERIODS: Period[] = ['7d', '30d', '90d', 'all'];

function parsePeriod(raw: string | undefined): Period {
  if (raw && VALID_PERIODS.includes(raw as Period)) return raw as Period;
  return '30d';
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ── GET /api/v1/reports/sales ──────────────────────────────────────────────
  @Get('sales')
  getSales(
    @Tenant() tenant: TenantContext,
    @Query('period') period: string,
  ) {
    return this.reportsService.getSalesSummary(tenant.id, parsePeriod(period));
  }

  // ── GET /api/v1/reports/products ───────────────────────────────────────────
  @Get('products')
  getProducts(
    @Tenant() tenant: TenantContext,
    @Query('period') period: string,
  ) {
    return this.reportsService.getTopProducts(tenant.id, parsePeriod(period));
  }

  // ── GET /api/v1/reports/customers ──────────────────────────────────────────
  @Get('customers')
  getCustomers(
    @Tenant() tenant: TenantContext,
    @Query('period') period: string,
  ) {
    return this.reportsService.getCustomerReport(tenant.id, parsePeriod(period));
  }

  // ── GET /api/v1/reports/orders/status ─────────────────────────────────────
  @Get('orders/status')
  getOrderStatus(
    @Tenant() tenant: TenantContext,
    @Query('period') period: string,
  ) {
    return this.reportsService.getOrderStatusReport(tenant.id, parsePeriod(period));
  }
}
