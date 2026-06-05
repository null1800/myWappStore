import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      FRONTEND_URL: 'http://localhost:3000',
    };
    return values[key];
  }),
  get: jest.fn().mockReturnValue('1h'),
};

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
      },
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  })),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── Register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      email: 'owner@example.com',
      password: 'SecurePass1',
      businessName: "Ray's Electronics",
      storeSlug: 'rays-electronics',
    };

    it('should throw ConflictException if slug is already taken', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'rays-electronics' },
      });
    });

    it('should throw ConflictException if email is already registered', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create tenant, user, and return tokens on success', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      // Mock the transaction
      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        return cb({
          tenant: {
            create: jest.fn().mockResolvedValue({
              id: 'tenant-uuid',
              slug: 'rays-electronics',
              name: "Ray's Electronics",
              plan: 'free',
            }),
          },
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-uuid',
              email: 'owner@example.com',
              fullName: null,
              role: 'OWNER',
              tenantId: 'tenant-uuid',
            }),
          },
        });
      });

      // Mock Supabase auth
      const supabaseAdmin = (service as any).supabaseAdmin;
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result.tenant.slug).toBe('rays-electronics');
      expect(result.user.role).toBe('OWNER');
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = { email: 'owner@example.com', password: 'SecurePass1' };

    it('should throw UnauthorizedException on invalid credentials', async () => {
      const supabaseAdmin = (service as any).supabaseAdmin;
      supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return tokens and user data on successful login', async () => {
      const supabaseAdmin = (service as any).supabaseAdmin;
      supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        authId: 'supabase-user-id',
        tenantId: 'tenant-uuid',
        email: 'owner@example.com',
        fullName: "Ray Mtonga",
        role: 'OWNER',
        isActive: true,
        tenant: {
          id: 'tenant-uuid',
          slug: 'rays-electronics',
          name: "Ray's Electronics",
          plan: 'free',
          isActive: true,
        },
      });

      const result = await service.login(loginDto);

      expect(result.response).toHaveProperty('accessToken');
      expect(result.refreshToken).toBeDefined();
      expect(result.response.user.role).toBe('OWNER');
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      const supabaseAdmin = (service as any).supabaseAdmin;
      supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        isActive: false,
        tenant: { isActive: true },
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should issue new access token for valid refresh token', async () => {
      mockJwt.verify.mockReturnValue({
        sub: 'user-uuid',
        tenantId: 'tenant-uuid',
        type: 'refresh',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        role: 'OWNER',
        email: 'owner@example.com',
        isActive: true,
      });

      const result = await service.refresh('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn');
    });
  });
});
