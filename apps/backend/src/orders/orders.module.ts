import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WhatsAppService } from './whatsapp.service';
import { CustomersModule } from '../customers/customers.module';
import { ProductsModule } from '../products/products.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    CustomersModule, // for CustomerService — auto-create customers on checkout
    ProductsModule,  // for InventoryService — deduct stock on order creation
    BillingModule,   // for PlanEnforcementService — monthly order limit check
  ],
  controllers: [OrdersController],
  providers: [OrdersService, WhatsAppService],
  exports: [OrdersService],
})
export class OrdersModule {}
