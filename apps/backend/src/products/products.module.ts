import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { InventoryService } from './inventory.service';
import { ProductVariantsService } from './product-variants.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, CategoriesService, InventoryService, ProductVariantsService],
  exports: [ProductsService, InventoryService, ProductVariantsService],
})
export class ProductsModule {}
