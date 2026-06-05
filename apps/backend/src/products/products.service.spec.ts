import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

const mockProduct = {
  id: 'product-uuid',
  name: 'iPhone 15 Case',
  slug: 'iphone-15-case',
  price: '140.00',
  compareAtPrice: null,
  sku: 'IPH-CASE-001',
  stockQuantity: 25,
  status: 'DRAFT',
  images: [],
  trackInventory: true,
  allowBackorder: false,
  createdAt: new Date(),
  category: null,
};

const mockPrisma = {
  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
  getPaginationParams: jest.fn().mockReturnValue({ skip: 0, take: 20 }),
};

const mockInventory = {
  adjustStock: jest.fn(),
  getInventoryHistory: jest.fn(),
  getLowStockProducts: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product with auto-generated slug', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null); // slug available
      mockPrisma.product.create.mockResolvedValue(mockProduct);

      const result = await service.create('tenant-uuid', {
        name: 'iPhone 15 Case',
        price: 140,
      });

      expect(result.name).toBe('iPhone 15 Case');
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'iphone-15-case',
            status: 'DRAFT',
          }),
        }),
      );
    });

    it('should append -2 to slug if original is taken', async () => {
      // First call (slug taken), second call (slug-2 available)
      mockPrisma.product.findFirst
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      mockPrisma.product.create.mockResolvedValue({ ...mockProduct, slug: 'iphone-15-case-2' });

      await service.create('tenant-uuid', { name: 'iPhone 15 Case', price: 140 });

      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'iphone-15-case-2' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return product when found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      const result = await service.findOne('tenant-uuid', 'product-uuid');
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException when product not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne('tenant-uuid', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('should archive the product (soft delete)', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'product-uuid', name: 'iPhone Case' });
      mockPrisma.product.update.mockResolvedValue({ status: 'ARCHIVED' });

      const result = await service.archive('tenant-uuid', 'product-uuid');
      expect(result.message).toContain('archived');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ARCHIVED' } }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(service.archive('tenant-uuid', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockProduct], 1]);
      const result = await service.findAll('tenant-uuid', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
