import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PLANS, type PlanId } from './plans';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  // ── GET /api/v1/billing ────────────────────────────────────────────────────
  // Current plan, subscription status, and available plans
  @Get()
  getSubscription(@Tenant() tenant: TenantContext) {
    return this.billingService.getSubscription(tenant.id);
  }

  // ── POST /api/v1/billing/upgrade ───────────────────────────────────────────
  // Returns a Paystack authorization URL to redirect the user to checkout
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  async initiateUpgrade(
    @Tenant() tenant: TenantContext,
    @Body() body: { plan: string; billingCycle?: 'monthly' | 'yearly' },
  ) {
    if (!body.plan || !PLANS[body.plan as PlanId]) {
      throw new BadRequestException(
        `Invalid plan. Choose from: ${Object.keys(PLANS).filter((p) => p !== 'free').join(', ')}`,
      );
    }

    return this.billingService.initiateUpgrade(
      tenant.id,
      body.plan as PlanId,
      body.billingCycle ?? 'monthly',
    );
  }

  // ── GET /api/v1/billing/verify ─────────────────────────────────────────────
  // Called by the frontend after Paystack redirects back with ?ref=xxx
  @Get('verify')
  async verifyPayment(
    @Tenant() tenant: TenantContext,
    @Query('ref') reference: string,
  ) {
    if (!reference) throw new BadRequestException('Missing payment reference.');
    return this.billingService.verifyUpgrade(tenant.id, reference);
  }

  // ── POST /api/v1/billing/cancel ────────────────────────────────────────────
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Tenant() tenant: TenantContext) {
    return this.billingService.cancelSubscription(tenant.id);
  }

  // ── GET /api/v1/billing/history ────────────────────────────────────────────
  @Get('history')
  getHistory(@Tenant() tenant: TenantContext) {
    return this.billingService.getBillingHistory(tenant.id);
  }

  // ── POST /api/v1/billing/webhook ───────────────────────────────────────────
  // Paystack sends events here. Raw body is needed for HMAC signature
  // verification — must NOT be parsed by NestJS's JSON body parser first.
  // Registered in main.ts with rawBody: true for this path.
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: Request, @Res() res: Response) {
    const signature = req.headers['x-paystack-signature'] as string;

    // req.rawBody is set by the raw body middleware in main.ts
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!rawBody) {
      // Shouldn't happen if main.ts is configured correctly; return 200 anyway
      // so Paystack doesn't keep retrying
      res.status(200).json({ received: true });
      return;
    }

    // Process async but respond 200 immediately — Paystack times out after
    // 5 seconds and retries if it gets a non-2xx
    res.status(200).json({ received: true });

    try {
      await this.billingService.handleWebhook(rawBody, signature);
    } catch (error) {
      // Response already sent — log but don't re-throw
      this.logger.error('Webhook processing error', error instanceof Error ? error.message : String(error));
    }
  }
}
