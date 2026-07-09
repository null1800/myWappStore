import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlanEnforcementService } from './plan-enforcement.service';
import { PaystackProvider } from './providers/paystack.provider';

@Module({
  controllers: [BillingController],
  providers: [BillingService, PlanEnforcementService, PaystackProvider],
  // Export PlanEnforcementService so other modules (products, staff, orders)
  // can inject it without importing BillingModule redundantly
  exports: [PlanEnforcementService],
})
export class BillingModule {}
