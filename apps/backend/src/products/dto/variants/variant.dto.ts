import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsNotEmpty,
  IsPositive,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string; // e.g. "Red / Large"

  @IsObject()
  options: Record<string, string>; // e.g. { "Color": "Red", "Size": "Large" }

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceOverride?: number; // null = inherit product price

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceOverride?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
