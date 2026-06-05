import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../products/inventory.service';
import { CustomersService } from '../customers/customers.service';
import { WhatsAppService } from './whatsapp.service';

const mockTenant = {
  id: 'tenant-uuid',
  name: "Ray's Electronics",
  phoneWhatsapp: '+260977000001',
  isActive: true,
};

const mockProduct = {
  id: 'product-uuid',
  name: 'iPhone 15 Case',
  sku: 'IPH-001',
  price: { toString: () => '140.00' },
  stockQuantity: 25,
  trackInventory: true,
  allowBackorder: false,
};

const mockPrisma = {
  tenant: { findUnique: jest.fn() },
  product: { findMany: jest.fn() },
  order: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  customer: { update: jest.fn() },
  $transaction: jest.fn(),
  getPaginationParams: jest.fn().mockReturnValue({ skip: 0, take: 20 }),
};

const mockInventory = { deductStockForOrder: jest.fn() };
const mockCustomers = { findOrCreate: jest.fn() };
const mockWhatsApp = {
  generateCheckoutLink: jest.fn().mockReturnValue('https://wa.me/260977000001?text=...'),
  buildOrderMessage: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
        { provide: CustomersService, useValue: mockCustomers },
        { provide: WhatsAppService, useValue: mockWhatsApp },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      storeSlug: 'rays-electronics',
      items: [{ productId: 'product-uuid', quantity: 2 }],
      customerName: 'John Banda',
      customerWhatsapp: '+260966000002',
    };

    it('should throw NotFoundException for unknown store slug', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if store has no WhatsApp number', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        ...mockTenant, phoneWhatsapp: null,
      });
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when product not found in store', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.product.findMany.mockResolvedValue([]); // no products found
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.product.findMany.mockResolvedValue([
        { ...mockProduct, stockQuantity: 1 }, // only 1, requested 2
      ]);
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should create order and return WhatsApp URL on success', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.order.count.mockResolvedValue(0); // for order number generation

      const mockOrder = {
        id: 'order-uuid',
        orderNumber: 'ORD-00001',
        subtotal: { toString: () => '280.00' },
        total: { toString: () => '280.00' },
        currency: 'ZMW',
        status: 'PENDING',
        items: [{
          productName: 'iPhone 15 Case',
          quantity: 2,
          unitPrice: { toString: () => '140.00' },
          lineTotal: { toString: () => '280.00' },
        }],
        customer: { id: 'cust-uuid', fullName: 'John Banda' },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn({
        customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'cust-uuid', fullName: 'John Banda' }), update: jest.fn() },
        order: { create: jest.fn().mockResolvedValue(mockOrder) },
        inventoryLog: { create: jest.fn() },
        product: { update: jest.fn() },
      }));

      mockCustomers.findOrCreate.mockResolvedValue({ id: 'cust-uuid' });

      const result = await service.create(dto);

      expect(result).toHaveProperty('order');
      expect(result).toHaveProperty('whatsappUrl');
      expect(result.whatsappUrl).toContain('wa.me');
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status when transition is valid', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-uuid',
        status: 'PENDING',
        orderNumber: 'ORD-00001',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'order-uuid',
        orderNumber: 'ORD-00001',
        status: 'CONFIRMED',
      });

      const result = await service.updateStatus('tenant-uuid', 'order-uuid', {
        status: 'CONFIRMED' as any,
      });

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw BadRequestException for invalid transition', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-uuid',
        status: 'DELIVERED', // terminal-ish state
        orderNumber: 'ORD-00001',
      });

      await expect(
        service.updateStatus('tenant-uuid', 'order-uuid', {
          status: 'PENDING' as any, // cannot go back to PENDING
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for CANCELLED terminal state', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-uuid',
        status: 'CANCELLED',
        orderNumber: 'ORD-00001',
      });

      await expect(
        service.updateStatus('tenant-uuid', 'order-uuid', {
          status: 'CONFIRMED' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── WhatsApp message format ────────────────────────────────────────────────

  describe('WhatsAppService.buildOrderMessage', () => {
    let waService: WhatsAppService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [WhatsAppService],
      }).compile();
      waService = module.get(WhatsAppService);
    });

    it('should include order number and items in message', () => {
      const msg = waService.buildOrderMessage({
        merchantPhone: '+260977000001',
        storeName: "Ray's Electronics",
        orderNumber: 'ORD-00001',
        items: [{ name: 'iPhone Case', quantity: 2, unitPrice: '140.00', lineTotal: '280.00' }],
        subtotal: '280.00',
        total: '280.00',
        currency: 'ZMW',
        customerName: 'John Banda',
        deliveryAddress: 'Woodlands, Lusaka',
      });

      expect(msg).toContain('ORD-00001');
      expect(msg).toContain('iPhone Case');
      expect(msg).toContain('ZMW 280.00');
      expect(msg).toContain('John Banda');
      expect(msg).toContain('Woodlands, Lusaka');
    });

    it('should generate valid wa.me link', () => {
      const link = waService.generateCheckoutLink({
        merchantPhone: '+260977000001',
        storeName: "Ray's Electronics",
        orderNumber: 'ORD-00001',
        items: [],
        subtotal: '0',
        total: '0',
        currency: 'ZMW',
      });

      expect(link).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    });
  });
});
