import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, CategoriesService, InventoryService],
  exports: [ProductsService, InventoryService],
})
export class ProductsModule {}
