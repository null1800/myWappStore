import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
  OrderQueryDto,
} from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';

// All routes: /api/v1/orders/...
@Controller({ path: 'orders', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Public: checkout ───────────────────────────────────────────────────────

  // POST /api/v1/orders
  // Called by the storefront when customer clicks "Order via WhatsApp".
  // No auth required — this is a public endpoint.
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  // ── Protected: merchant dashboard ─────────────────────────────────────────

  // GET /api/v1/orders/summary
  // Dashboard overview stats — must be before :id to avoid route conflict
  @Get('summary')
  getSummary(@Tenant() tenant: TenantContext) {
    return this.ordersService.getSummary(tenant.id);
  }

  // GET /api/v1/orders?status=PENDING&page=1&search=ORD-00001
  @Get()
  findAll(
    @Tenant() tenant: TenantContext,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findAll(tenant.id, query);
  }

  // GET /api/v1/orders/:id
  @Get(':id')
  findOne(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOne(tenant.id, id);
  }

  // PATCH /api/v1/orders/:id/status
  @Patch(':id/status')
  updateStatus(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(tenant.id, id, dto);
  }

  // PATCH /api/v1/orders/:id/payment
  @Patch(':id/payment')
  updatePaymentStatus(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.ordersService.updatePaymentStatus(tenant.id, id, dto);
  }

  // GET /api/v1/orders/:id/whatsapp
  // Regenerates the WhatsApp link for an existing order
  // Merchant can share this from the dashboard if customer needs it resent
  @Get(':id/whatsapp')
  getWhatsAppLink(
    @Tenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.getWhatsAppLink(tenant.id, id);
  }
}
