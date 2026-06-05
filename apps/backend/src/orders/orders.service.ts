import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../products/inventory.service';
import { CustomersService } from '../customers/customers.service';
import { WhatsAppService } from './whatsapp.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
  OrderQueryDto,
} from './dto/order.dto';
// Decimal handling removed; using native number

// Valid order status transitions — prevents illegal state changes
// e.g. a DELIVERED order cannot go back to PENDING
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PACKED', 'CANCELLED'],
  PACKED:     ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED:  ['REFUNDED'],
  CANCELLED:  [],   // terminal state
  REFUNDED:   [],   // terminal state
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly customers: CustomersService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ── CREATE ORDER ───────────────────────────────────────────────────────────
  // Public endpoint — called when customer initiates WhatsApp checkout.
  // This runs atomically: resolve products → validate stock → create order →
  // deduct stock → auto-create/find customer → generate WhatsApp link.
  async create(dto: CreateOrderDto): Promise<{
    order: Record<string, unknown>;
    whatsappUrl: string;
  }> {
    // 1. Resolve tenant from store slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.storeSlug },
      select: {
        id: true,
        name: true,
        phoneWhatsapp: true,
        isActive: true,
      },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(`Store "${dto.storeSlug}" not found.`);
    }

    if (!tenant.phoneWhatsapp) {
      throw new BadRequestException(
        'This store has not set up a WhatsApp number yet. Please contact the store directly.',
      );
    }

    // 2. Load and validate all products in one query
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: tenant.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true,
        trackInventory: true,
        allowBackorder: true,
      },
    });

    // Verify all requested products exist and are active in this store
    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missing = productIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `One or more products are unavailable: ${missing.join(', ')}`,
      );
    }

    // Build product lookup map for O(1) access
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Validate stock availability upfront before touching the DB
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;

      if (
        product.trackInventory &&
        !product.allowBackorder &&
        product.stockQuantity < item.quantity
      ) {
        throw new BadRequestException(
          `"${product.name}" only has ${product.stockQuantity} units available. You requested ${item.quantity}.`,
        );
      }
    }

    // 4. Calculate totals
    const orderItems = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * item.quantity;

      return {
        productId: item.productId,
        productName: product.name,
        productSku: product.sku,
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

    // 5. Generate order number — human-readable sequential format
    const orderNumber = await this.generateOrderNumber(tenant.id);

    // 6. Execute everything in a single transaction
    const order = await this.prisma.$transaction(async (tx) => {
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
          status: 'PENDING',
          subtotal,
          discountAmount: 0,
          total,
          currency: 'ZMW',
          paymentMethod: dto.paymentMethod ?? 'whatsapp',
          paymentStatus: 'UNPAID',
          deliveryAddress: dto.deliveryAddress ?? null,
          notes: dto.notes ?? null,
          whatsappSentAt: new Date(),
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSku,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: {
          items: true,
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
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
      subtotal: order.subtotal.toString(),
      total: order.total.toString(),
      currency: order.currency,
      customerName: dto.customerName,
      deliveryAddress: dto.deliveryAddress,
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
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productSku: true,
            unitPrice: true,
            quantity: true,
            lineTotal: true,
          },
        },
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

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

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        ...(dto.merchantNotes !== undefined && { merchantNotes: dto.merchantNotes }),
      },
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

    return this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: dto.paymentStatus },
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
      items: order.items.map((i) => ({
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
  // Format: ORD-00001, ORD-00002, etc. — sequential per tenant
  private async generateOrderNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.order.count({ where: { tenantId } });
    const next = count + 1;
    return `ORD-${String(next).padStart(5, '0')}`;
  }
}
