import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsPositive,
  IsNotEmpty,
  IsEmail,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Order Item (line item inside CreateOrderDto) ─────────────────────────────

export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @IsPositive({ message: 'Quantity must be at least 1' })
  @Type(() => Number)
  quantity: number;
}

// ─── Create Order ─────────────────────────────────────────────────────────────
// Called when customer clicks "Order via WhatsApp" on the storefront.
// No auth required — this is a public endpoint.

export class CreateOrderDto {
  // The store slug is passed so the API can resolve tenantId without auth
  @IsString()
  @IsNotEmpty()
  storeSlug: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  // Customer info — used to auto-create or find existing customer record
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerWhatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Payment method chosen at checkout
  @IsOptional()
  @IsString()
  paymentMethod?: string; // 'whatsapp' | 'mobile_money' | 'cash'
}

// ─── Update Order Status ──────────────────────────────────────────────────────

export enum OrderStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PACKED = 'PACKED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatusEnum, {
    message: `Status must be one of: ${Object.values(OrderStatusEnum).join(', ')}`,
  })
  status: OrderStatusEnum;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  merchantNotes?: string;
}

// ─── Update Payment Status ────────────────────────────────────────────────────

export enum PaymentStatusEnum {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  REFUNDED = 'REFUNDED',
}

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatusEnum)
  paymentStatus: PaymentStatusEnum;
}

// ─── Order Query / Filters ────────────────────────────────────────────────────

export class OrderQueryDto {
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
  @IsEnum(OrderStatusEnum)
  status?: OrderStatusEnum;

  @IsOptional()
  @IsString()
  search?: string; // searches order number or customer name

  @IsOptional()
  @IsString()
  dateFrom?: string; // ISO date string

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
