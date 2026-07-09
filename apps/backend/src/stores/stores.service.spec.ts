import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { StoresService } from './stores.service';
import { PrismaService } from '../prisma/prisma.service';
import { InProcessCacheService } from '../common/cache/cache.service';

const mockCache = {
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
  invalidate: jest.fn(),
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTenant = {
  id: 'tenant-uuid',
  slug: 'rays-electronics',
  name: "Ray's Electronics",
  email: 'ray@example.com',
  description: 'Best electronics in Lusaka',
  logoUrl: null,
  bannerUrl: null,
  primaryColor: '#0F6E56',
  phoneWhatsapp: '+260977000001',
  isPublic: true,
  isActive: true,
  plan: 'free',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
  getPaginationParams: jest.fn().mockReturnValue({ skip: 0, take: 20 }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StoresService', () => {
  let service: StoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InProcessCacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
    jest.clearAllMocks();
  });

  // ── getMyStore ─────────────────────────────────────────────────────────────

  describe('getMyStore', () => {
    it('should return the merchant store', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      const result = await service.getMyStore('tenant-uuid');
      expect(result).toEqual(mockTenant);
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tenant-uuid' } }),
      );
    });

    it('should throw NotFoundException if store not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getMyStore('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateMyStore ──────────────────────────────────────────────────────────

  describe('updateMyStore', () => {
    it('should update store fields', async () => {
      const updated = { ...mockTenant, description: 'Updated description' };
      mockPrisma.tenant.update.mockResolvedValue(updated);

      const result = await service.updateMyStore('tenant-uuid', {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });
  });

  // ── updateSlug ─────────────────────────────────────────────────────────────

  describe('updateSlug', () => {
    it('should throw ConflictException if slug is taken by another store', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: 'other-tenant' });

      await expect(
        service.updateSlug('tenant-uuid', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update slug if available', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.update.mockResolvedValue({ ...mockTenant, slug: 'new-slug' });

      const result = await service.updateSlug('tenant-uuid', { slug: 'new-slug' });
      expect(result.slug).toBe('new-slug');
    });
  });

  // ── checkSlugAvailability ──────────────────────────────────────────────────

  describe('checkSlugAvailability', () => {
    it('should return available: true when slug is free', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      const result = await service.checkSlugAvailability('new-store');
      expect(result).toEqual({ available: true, slug: 'new-store' });
    });

    it('should return available: false when slug is taken', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: 'other-id' });
      const result = await service.checkSlugAvailability('taken-store');
      expect(result).toEqual({ available: false, slug: 'taken-store' });
    });
  });

  // ── getPublicStore ─────────────────────────────────────────────────────────

  describe('getPublicStore', () => {
    it('should return public store data', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      const result = await service.getPublicStore('rays-electronics');
      expect((result as any).slug).toBe('rays-electronics');
    });

    it('should throw NotFoundException for unknown slug', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getPublicStore('ghost-store')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPublicStoreProducts ─────────────────────────────────────────────────

  describe('getPublicStoreProducts', () => {
    it('should return paginated products for a valid store', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-uuid', isActive: true });
      mockPrisma.$transaction.mockResolvedValue([
        [{ id: 'p1', name: 'iPhone Case', price: '140.00' }],
        1,
      ]);

      const result = await service.getPublicStoreProducts('rays-electronics', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should throw NotFoundException for inactive store', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-uuid', isActive: false });
      await expect(
        service.getPublicStoreProducts('inactive-store'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── listPublicStores ───────────────────────────────────────────────────────

  describe('listPublicStores', () => {
    it('should return paginated list of public stores', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockTenant], 1]);

      const result = await service.listPublicStores(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply search filter when provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.listPublicStores(1, 20, 'fashion');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
