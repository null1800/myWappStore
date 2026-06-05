import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertCustomerData {
  fullName?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  deliveryAddress?: string;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Find or create customer on checkout ───────────────────────────────────
  // Called inside the order creation transaction.
  // Matches on WhatsApp number first, then email, then phone.
  // If no match, creates a new customer record.
  // tx = Prisma transaction client (passed from OrdersService)
  async findOrCreate(
    tenantId: string,
    data: UpsertCustomerData,
    tx?: any,
  ) {
    const client = tx ?? this.prisma;

    // Build match conditions in priority order
    const matchConditions = [];
    if (data.whatsappNumber) {
      matchConditions.push({ tenantId, whatsappNumber: data.whatsappNumber });
    }
    if (data.email) {
      matchConditions.push({ tenantId, email: data.email });
    }
    if (data.phone) {
      matchConditions.push({ tenantId, phone: data.phone });
    }

    // Try to find existing customer
    let customer = null;
    if (matchConditions.length > 0) {
      customer = await client.customer.findFirst({
        where: { OR: matchConditions },
        select: { id: true, fullName: true, totalOrders: true },
      });
    }

    if (customer) {
      // Update any new info provided (e.g. they gave their name this time)
      await client.customer.update({
        where: { id: customer.id },
        data: {
          ...(data.fullName && !customer.fullName && { fullName: data.fullName }),
          ...(data.deliveryAddress && { deliveryAddress: data.deliveryAddress }),
        },
      });
      return customer;
    }

    // Create new customer
    const newCustomer = await client.customer.create({
      data: {
        tenantId,
        fullName: data.fullName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        whatsappNumber: data.whatsappNumber ?? null,
        deliveryAddress: data.deliveryAddress ?? null,
      },
      select: { id: true, fullName: true },
    });

    this.logger.log(`New customer created for tenant ${tenantId}: ${newCustomer.id}`);
    return newCustomer;
  }

  // ── LIST customers (dashboard) ─────────────────────────────────────────────
  async findAll(tenantId: string, page = 1, limit = 20, search?: string) {
    const { skip, take } = this.prisma.getPaginationParams(page, limit);

    const where = {
      tenantId,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { whatsappNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          whatsappNumber: true,
          totalOrders: true,
          totalSpent: true,
          createdAt: true,
        },
        orderBy: { totalSpent: 'desc' }, // top spenders first
        skip,
        take,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  // ── GET customer with order history ───────────────────────────────────────
  async findOne(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            currency: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // last 10 orders
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }

  // ── UPDATE customer notes (merchant only) ─────────────────────────────────
  async updateNotes(tenantId: string, customerId: string, notes: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });

    if (!customer) throw new NotFoundException('Customer not found.');

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { notes },
      select: { id: true, notes: true },
    });
  }
}
