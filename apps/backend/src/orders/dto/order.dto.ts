import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsPositive,
  IsNotEmpty,
  IsEmail,
  IsIn,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Order Item ────────────────────────────────────────────────────────────────

export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsInt()
  @IsPositive({ message: 'Quantity must be at least 1' })
  @Type(() => Number)
  quantity: number;
}

// Fulfillment types — how the customer wants to receive the order
export const FULFILLMENT_TYPES = ['DELIVERY', 'PICKUP', 'DINE_IN', 'QUOTE', 'BOOKING'] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

// ─── Create Order ─────────────────────────────────────────────────────────────
// Public endpoint — no auth required. storeSlug resolves the tenant.

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  storeSlug: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  // Customer info
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

  // Fulfillment
  @IsOptional()
  @IsIn(FULFILLMENT_TYPES, {
    message: `fulfillmentType must be one of: ${FULFILLMENT_TYPES.join(', ')}`,
  })
  fulfillmentType?: FulfillmentType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  tableNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

// ─── Update Order Status ──────────────────────────────────────────────────────

export enum OrderStatusEnum {
  PENDING    = 'PENDING',
  CONFIRMED  = 'CONFIRMED',
  PACKED     = 'PACKED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED  = 'DELIVERED',
  READY      = 'READY',
  CANCELLED  = 'CANCELLED',
  REFUNDED   = 'REFUNDED',
  QUOTE_SENT = 'QUOTE_SENT',
  BOOKED     = 'BOOKED',
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

  // For restaurants: set when kitchen says the order will be ready
  @IsOptional()
  @IsDateString()
  estimatedReadyAt?: string;
}

// ─── Update Payment Status ────────────────────────────────────────────────────

export enum PaymentStatusEnum {
  UNPAID         = 'UNPAID',
  PAID           = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  REFUNDED       = 'REFUNDED',
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
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
