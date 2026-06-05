import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Supabase Admin client — initialized in constructor after ConfigService is available
  private readonly supabaseAdmin;


  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    // Initialize Supabase admin client here using injected ConfigService
    this.supabaseAdmin = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  // ── Register ───────────────────────────────────────────────────────────────
  // Creates: Supabase Auth user → Tenant row → User row (in a transaction)
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // 1. Check slug availability before doing anything else
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.storeSlug },
    });

    if (existingTenant) {
      throw new ConflictException(
        `The store URL "${dto.storeSlug}" is already taken. Please choose a different one.`,
      );
    }

    // 2. Check email availability
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    // 3. Create Supabase Auth user (handles password hashing)
    const { data: authData, error: authError } =
      await this.supabaseAdmin.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true, // auto-confirm for now; add email flow in Phase 2
      });

    if (authError || !authData.user) {
      this.logger.error('Supabase Auth user creation failed', authError);
      throw new InternalServerErrorException(
        'Failed to create account. Please try again.',
      );
    }

    const supabaseUserId = authData.user.id;

    try {
      // 4. Create Tenant + User in a Prisma transaction
      // If either fails, both are rolled back. Then we clean up Supabase Auth.
      const { tenant, user } = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: dto.storeSlug,
            name: dto.businessName,
            email: dto.email,
            phoneWhatsapp: dto.phoneWhatsapp ?? null,
          },
        });

        const user = await tx.user.create({
          data: {
            authId: supabaseUserId,
            tenantId: tenant.id,
            email: dto.email,
            fullName: dto.fullName ?? null,
            role: 'OWNER',
          },
        });

        return { tenant, user };
      });

      // 5. Issue tokens
      const tokens = this.issueTokens(user.id, tenant.id, user.role, user.email);

      this.logger.log(`New merchant registered: ${dto.email} → store: ${dto.storeSlug}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          plan: tenant.plan,
        },
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      // Transaction failed — clean up the Supabase Auth user we already created
      this.logger.error('Transaction failed, rolling back Supabase user', error);
      await this.supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
      throw new InternalServerErrorException(
        'Registration failed. Please try again.',
      );
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<{ response: AuthResponseDto; refreshToken: string }> {
    // 1. Verify credentials via Supabase Auth
    const { data: authData, error: authError } =
      await this.supabaseAdmin.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (authError || !authData.user) {
      // Use a generic message — never reveal whether email or password is wrong
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 2. Load user from our database (includes tenant_id and role)
    const user = await this.prisma.user.findUnique({
      where: { authId: authData.user.id },
      include: { tenant: true },
    });

    if (!user) {
      this.logger.error(`Auth user exists in Supabase but not in DB: ${authData.user.id}`);
      throw new UnauthorizedException('Account not found. Please contact support.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
    }

    if (!user.tenant?.isActive) {
      throw new UnauthorizedException('Your store has been deactivated. Please contact support.');
    }

    // 3. Issue tokens
    const tokens = this.issueTokens(
      user.id,
      user.tenantId!,
      user.role,
      user.email,
    );

    const refreshToken = this.issueRefreshToken(user.id, user.tenantId!);

    return {
      response: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        tenant: {
          id: user.tenant!.id,
          slug: user.tenant!.slug,
          name: user.tenant!.name,
          plan: user.tenant!.plan,
        },
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
      refreshToken,
    };
  }

  // ── Refresh ────────────────────────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const payload = this.jwt.verify<{
        sub: string;
        tenantId: string;
        type: string;
      }>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Re-load user to get current role (it may have changed)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, tenantId: true, role: true, email: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Session expired. Please log in again.');
      }

      const tokens = this.issueTokens(user.id, user.tenantId!, user.role, user.email);

      return tokens;
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    // Always return success — never reveal if email exists (prevents enumeration)
    try {
      await this.supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${this.config.get('FRONTEND_URL')}/auth/reset-password`,
      });
    } catch (error) {
      // Log but don't throw — user sees success regardless
      this.logger.warn(`Password reset attempted for unknown email: ${email}`);
    }
  }

  // ── Validate user (called by JwtStrategy) ─────────────────────────────────
  // Returns the user from DB, confirming they still exist and are active
  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;
    return user;
  }

  // ── Private: token issuance ────────────────────────────────────────────────

  private issueTokens(
    userId: string,
    tenantId: string,
    role: string,
    email: string,
  ): { accessToken: string; expiresIn: number } {
    const expiresIn = 3600; // 1 hour in seconds

    const accessToken = this.jwt.sign(
      {
        sub: userId,
        tenantId,
        role,
        email,
      },
      {
        expiresIn,
        secret: this.config.getOrThrow('JWT_SECRET'),
      },
    );

    return { accessToken, expiresIn };
  }

  private issueRefreshToken(userId: string, tenantId: string): string {
    return this.jwt.sign(
      {
        sub: userId,
        tenantId,
        type: 'refresh', // prevents access tokens being used as refresh tokens
      },
      {
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      },
    );
  }
}
