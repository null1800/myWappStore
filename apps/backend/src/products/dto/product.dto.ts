import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  IsUUID,
  IsPositive,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductStatusEnum {
  ACTIVE = 'ACTIVE',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

// ─── Create Product ───────────────────────────────────────────────────────────

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Slug is auto-generated from name if not provided
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must be a valid number with up to 2 decimal places' })
  @IsPositive({ message: 'Price must be greater than 0' })
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  compareAtPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @IsOptional()
  @IsEnum(ProductStatusEnum)
  status?: ProductStatusEnum;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  weightGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;
}

// ─── Update Product ───────────────────────────────────────────────────────────
// All fields optional — PATCH semantics

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  compareAtPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @IsOptional()
  @IsEnum(ProductStatusEnum)
  status?: ProductStatusEnum;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  weightGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;
}

// ─── Stock Adjustment ─────────────────────────────────────────────────────────

export enum StockAdjustmentReason {
  RESTOCK = 'restock',
  ADJUSTMENT = 'adjustment',
  RETURN = 'return',
  DAMAGE = 'damage',
}

export class AdjustStockDto {
  @IsInt({ message: 'Quantity must be a whole number' })
  // Positive = add stock, Negative = remove stock
  // e.g. 50 means "add 50 units", -3 means "remove 3 units"
  @Type(() => Number)
  changeQty: number;

  @IsEnum(StockAdjustmentReason)
  reason: StockAdjustmentReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ─── Query / Filter ───────────────────────────────────────────────────────────

export class ProductQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ProductStatusEnum)
  status?: ProductStatusEnum;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  lowStock?: boolean; // filters products where stockQuantity <= 5
}

// ─── Category DTOs ────────────────────────────────────────────────────────────

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
