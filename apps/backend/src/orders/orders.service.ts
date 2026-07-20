import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../products/inventory.service';
import { CustomersService } from '../customers/customers.service';
import { WhatsAppService } from './whatsapp.service';
import { PlanEnforcementService } from '../billing/plan-enforcement.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
  OrderQueryDto,
} from './dto/order.dto';
// Decimal handling removed; using native number

// Valid order status transitions — prevents illegal state changes.
// New business-type-specific statuses are additive; existing retail/restaurant
// flows are unchanged. Branches:
//   Retail: PENDING → CONFIRMED → PACKED → DISPATCHED → DELIVERED
//   Restaurant pickup: PENDING → CONFIRMED → PACKED → READY → DELIVERED
//   Service/quote: PENDING → QUOTE_SENT → CONFIRMED → BOOKED → DELIVERED
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['CONFIRMED', 'QUOTE_SENT', 'CANCELLED'],
  CONFIRMED:  ['PACKED', 'BOOKED', 'CANCELLED'],
  PACKED:     ['DISPATCHED', 'READY', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  READY:      ['DELIVERED', 'CANCELLED'],
  DELIVERED:  ['REFUNDED'],
  QUOTE_SENT: ['CONFIRMED', 'CANCELLED'],
  BOOKED:     ['DELIVERED', 'CANCELLED'],
  CANCELLED:  [],  // terminal
  REFUNDED:   [],  // terminal
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly customers: CustomersService,
    private readonly whatsapp: WhatsAppService,
    private readonly planEnforcement: PlanEnforcementService,
  ) {}

  // ── CREATE ORDER ───────────────────────────────────────────────────────────
  // Public endpoint — called when customer initiates WhatsApp checkout.
  // This runs atomically: resolve products → validate stock → create order →
  // deduct stock → auto-create/find customer → generate WhatsApp link.
  async create(dto: CreateOrderDto) {
    // 1. Resolve tenant from store slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.storeSlug },
      select: {
        id: true, name: true, phoneWhatsapp: true, isActive: true, plan: true,
        businessType: true,
      },
    });

    if (!tenant?.isActive) {
      throw new BadRequestException('This store is not currently accepting orders.');
    }

    if (!tenant.phoneWhatsapp) {
      throw new BadRequestException(
        'This store has not set up a WhatsApp number yet. Please contact the store directly.',
      );
    }

    // Check monthly order limit (free plan: 50/month, starter: 500/month)
    await this.planEnforcement.assertCanPlaceOrder(tenant.id);

    // 2. Load and validate all products in one query
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const variantIds = dto.items.map((i) => i.variantId).filter(Boolean) as string[];

    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, tenantId: tenant.id, status: 'ACTIVE' },
        select: {
          id: true, name: true, sku: true, price: true,
          stockQuantity: true, trackInventory: true, allowBackorder: true,
          hasVariants: true,
        },
      }),
      variantIds.length > 0
        ? this.prisma.productVariant.findMany({
            where: { id: { in: variantIds }, tenantId: tenant.id, isActive: true },
            select: {
              id: true, name: true, sku: true, priceOverride: true,
              stockQuantity: true, productId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // Verify all requested products exist and are active in this store
    if (products.length !== productIds.length) {
      const foundIds = products.map((p: any) => p.id);
      const missing = productIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `One or more products are unavailable: ${missing.join(', ')}`,
      );
    }

    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));
    const variantMap = new Map<string, any>(variants.map((v: any) => [v.id, v]));

    // 3. Validate stock availability upfront
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== item.productId) {
          throw new BadRequestException(
            `Variant not found for product "${product.name}".`,
          );
        }
        if (!product.allowBackorder && variant.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `"${product.name} — ${variant.name}" only has ${variant.stockQuantity} available.`,
          );
        }
      } else if (
        product.trackInventory &&
        !product.allowBackorder &&
        product.stockQuantity < item.quantity
      ) {
        throw new BadRequestException(
          `"${product.name}" only has ${product.stockQuantity} units available. You requested ${item.quantity}.`,
        );
      }
    }

    // 4. Calculate totals — variant price overrides product price when set
    const orderItems = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      const unitPrice = variant?.priceOverride != null
        ? Number(variant.priceOverride)
        : Number(product.price);
      const lineTotal = unitPrice * item.quantity;

      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        productName: product.name,
        productSku: variant?.sku ?? product.sku,
        variantName: variant?.name ?? null,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );
    const total = subtotal; // discounts in Phase 2

    // 5. Execute everything in a single transaction
    const order = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Atomically increment the tenant's order counter and derive the order
      // number from the returned value. This UPDATE takes a row lock on the
      // tenant row, so concurrent checkouts for the same store serialize
      // here instead of racing on a SELECT count() — eliminates duplicate
      // order numbers under concurrent load.
      const counterUpdate = await tx.tenant.update({
        where: { id: tenant.id },
        data: { orderSequence: { increment: 1 } },
        select: { orderSequence: true },
      });
      const orderNumber = `ORD-${String(counterUpdate.orderSequence).padStart(5, '0')}`;

      // Auto-create or find existing customer
      let customerId: string | null = null;

      if (dto.customerWhatsapp || dto.customerEmail || dto.customerPhone) {
        const customer = await this.customers.findOrCreate(
          tenant.id,
          {
            fullName: dto.customerName,
            email: dto.customerEmail,
            phone: dto.customerPhone,
            whatsappNumber: dto.customerWhatsapp,
            deliveryAddress: dto.deliveryAddress,
          },
          tx,
        );
        customerId = customer.id;
      }

      // Create the order
      const createdOrder = await tx.order.create({
        data: {
          tenantId: tenant.id,
          customerId,
          orderNumber,
          status: dto.fulfillmentType === 'QUOTE' ? 'PENDING'
                : dto.fulfillmentType === 'BOOKING' ? 'PENDING'
                : 'PENDING',
          subtotal,
          discountAmount: 0,
          total,
          currency: 'ZMW',
          paymentMethod: dto.paymentMethod ?? 'whatsapp',
          paymentStatus: 'UNPAID',
          fulfillmentType: dto.fulfillmentType ?? 'DELIVERY',
          deliveryAddress: dto.deliveryAddress ?? null,
          scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
          tableNumber: dto.tableNumber ?? null,
          notes: dto.notes ?? null,
          whatsappSentAt: new Date(),
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId ?? null,
              productName: item.productName,
              productSku: item.productSku,
              variantName: item.variantName ?? null,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: {
          items: {
            select: {
              id: true,
              productName: true,
              variantName: true,
              productSku: true,
              unitPrice: true,
              quantity: true,
              lineTotal: true,
            },
          },
          customer: {
            select: { id: true, fullName: true, whatsappNumber: true },
          },
        },
      });

      // Deduct stock for each item inside the same transaction
      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        await this.inventory.deductStockForOrder({
          productId: item.productId,
          variantId: item.variantId,
          tenantId: tenant.id,
          quantity: item.quantity,
          orderId: createdOrder.id,
          allowBackorder: product.allowBackorder,
          tx,
        });
      }

      // Update customer spend totals
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: total },
          },
        });
      }

      return createdOrder;
    });

    // 7. Generate WhatsApp checkout URL
    const whatsappUrl = this.whatsapp.generateCheckoutLink({
      merchantPhone: tenant.phoneWhatsapp,
      storeName: tenant.name,
      orderNumber: order.orderNumber,
      items: order.items.map((item: any) => ({
        name: item.variantName ? `${item.productName} (${item.variantName})` : item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
      subtotal: order.subtotal.toString(),
      total: order.total.toString(),
      currency: order.currency,
      customerName: dto.customerName,
      fulfillmentType: dto.fulfillmentType ?? 'DELIVERY',
      deliveryAddress: dto.deliveryAddress,
      tableNumber: dto.tableNumber,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
      notes: dto.notes,
    });

    this.logger.log(
      `Order created: ${order.orderNumber} | Store: ${dto.storeSlug} | Total: ${order.total}`,
    );

    return { order, whatsappUrl };
  }

  // ── LIST ORDERS (dashboard) ────────────────────────────────────────────────
  async findAll(tenantId: string, query: OrderQueryDto) {
    const { page = 1, limit = 20, status, search, dateFrom, dateTo, customerId } = query;
    const { skip, take } = this.prisma.getPaginationParams(page, limit);

    const where = {
      tenantId,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          { customer: { fullName: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          currency: true,
          paymentStatus: true,
          paymentMethod: true,
          createdAt: true,
          customer: {
            select: { id: true, fullName: true, whatsappNumber: true, phone: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ── GET ORDER DETAIL ───────────────────────────────────────────────────────
  async findOne(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        fulfillmentType: true,
        deliveryAddress: true,
        scheduledFor: true,
        estimatedReadyAt: true,
        tableNumber: true,
        subtotal: true,
        discountAmount: true,
        total: true,
        currency: true,
        notes: true,
        merchantNotes: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            productName: true,
            productSku: true,
            variantName: true,
            unitPrice: true,
            quantity: true,
            lineTotal: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            whatsappNumber: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  // ── UPDATE ORDER STATUS ────────────────────────────────────────────────────
  async updateStatus(
    tenantId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    // Enforce valid state machine transitions
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot change order status from ${order.status} to ${dto.status}. ` +
          `Allowed transitions: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`,
      );
    }

    const result = await this.prisma.order.updateMany({
      where: { id: orderId, tenantId },
      data: {
        status: dto.status,
        ...(dto.merchantNotes !== undefined && { merchantNotes: dto.merchantNotes }),
        ...(dto.estimatedReadyAt !== undefined && {
          estimatedReadyAt: new Date(dto.estimatedReadyAt),
        }),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Order not found.');
    }

    const updated = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        merchantNotes: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Order ${order.orderNumber}: ${order.status} → ${dto.status}`,
    );

    return updated;
  }

  // ── UPDATE PAYMENT STATUS ──────────────────────────────────────────────────
  async updatePaymentStatus(
    tenantId: string,
    orderId: string,
    dto: UpdatePaymentStatusDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const result = await this.prisma.order.updateMany({
      where: { id: orderId, tenantId },
      data: { paymentStatus: dto.paymentStatus },
    });

    if (result.count === 0) {
      throw new NotFoundException('Order not found.');
    }

    return this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, orderNumber: true, paymentStatus: true },
    });
  }

  // ── REGENERATE WHATSAPP LINK ───────────────────────────────────────────────
  // Merchant can resend the WA link from the dashboard if the customer needs it again
  async getWhatsAppLink(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: true,
        customer: { select: { fullName: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, phoneWhatsapp: true },
    });

    if (!tenant?.phoneWhatsapp) {
      throw new BadRequestException('Store WhatsApp number not configured.');
    }

    const url = this.whatsapp.generateCheckoutLink({
      merchantPhone: tenant.phoneWhatsapp,
      storeName: tenant.name,
      orderNumber: order.orderNumber,
      items: order.items.map((i: any) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toString(),
        lineTotal: i.lineTotal.toString(),
      })),
      subtotal: order.subtotal.toString(),
      total: order.total.toString(),
      currency: order.currency,
      customerName: order.customer?.fullName ?? undefined,
      deliveryAddress: order.deliveryAddress ?? undefined,
      notes: order.notes ?? undefined,
    });

    return { whatsappUrl: url, orderNumber: order.orderNumber };
  }

  // ── DASHBOARD SUMMARY ──────────────────────────────────────────────────────
  async getSummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      pendingOrders,
      todayOrders,
      revenueResult,
      todayRevenueResult,
    ] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.order.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: today } } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: {
          tenantId,
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
          createdAt: { gte: today },
        },
        _sum: { total: true },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      todayOrders,
      totalRevenue: revenueResult._sum.total?.toString() ?? '0',
      todayRevenue: todayRevenueResult._sum.total?.toString() ?? '0',
    };
  }

  // ── Private: order number generation ──────────────────────────────────────
  // NOTE: order numbers are now generated atomically inside the create()
  // transaction via an incrementing tenant.orderSequence counter — see
  // above. This avoids the SELECT count()+1 race that allowed concurrent
  // checkouts to generate duplicate order numbers.
}
