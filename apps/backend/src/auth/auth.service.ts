import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
} from './dto/auth.dto';

// Parses simple duration strings like "7d", "12h", "30m", "45s" into
// milliseconds. Falls back to 7 days if the format isn't recognized —
// only used to compute the refresh_tokens.expires_at DB column; the JWT's
// own expiry is still enforced by jsonwebtoken via the same config value.
function parseDurationToMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = /^(\d+)\s*(d|h|m|s)$/.exec(value.trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
  return amount * unitMs;
}

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
      this.config.getOrThrow('NEXT_PUBLIC_SUPABASE_URL'),
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
        email_confirm: true, // auto-confirm so users can log in immediately; verification email is still sent for informational purposes
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
      const { tenant, user } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      // 6. Send the verification email — best-effort. Registration already
      // succeeded at this point (tenant/user exist, tokens issued), so a
      // failure here shouldn't fail the whole request; the user can use
      // "resend verification email" from the dashboard instead.
      this.supabaseAdmin.auth
        .resend({
          type: 'signup',
          email: dto.email,
          options: { emailRedirectTo: `${this.config.get('FRONTEND_URL')}/auth/verify-email` },
        })
        .catch((err: unknown) => {
          this.logger.warn(`Failed to send verification email to ${dto.email}`, err);
        });

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          emailVerified: false,
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

    // Lazily sync verification status — Supabase confirms the email when the
    // user clicks the link, but that happens on Supabase's own redirect, not
    // through our API. signInWithPassword's response already tells us the
    // current state, so piggyback on every login to keep our copy current
    // without needing a webhook.
    const supabaseConfirmedAt = authData.user.email_confirmed_at;
    let emailVerifiedAt = user.emailVerifiedAt;
    if (supabaseConfirmedAt && !emailVerifiedAt) {
      emailVerifiedAt = new Date(supabaseConfirmedAt);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt },
      });
    }

    // 3. Issue tokens
    const tokens = this.issueTokens(
      user.id,
      user.tenantId!,
      user.role,
      user.email,
    );

    const refreshToken = await this.issueRefreshToken(user.id, user.tenantId!);

    return {
      response: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          emailVerified: !!emailVerifiedAt,
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
  // Rotation: every refresh token is single-use. A successful refresh revokes
  // the token that was just used and issues a brand new one. If a token is
  // presented after it's already been revoked, that's a signal the token was
  // captured and reused (e.g. stolen, replayed from a stale copy) — every
  // other active token for that user is revoked too, forcing re-login
  // everywhere.
  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
  }> {
    let payload: { sub: string; tenantId: string; type: string; jti: string };

    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (tokenRecord.revokedAt) {
      // This refresh token was already used once before — reuse detected.
      // Revoke every other active token for this user as a precaution.
      this.logger.warn(
        `Refresh token reuse detected for user ${tokenRecord.userId}. Revoking all active sessions.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Re-load user to get current role (it may have changed) and confirm
    // they're still active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tenantId: true, role: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Rotate: revoke the token just used, issue a new one
    await this.prisma.refreshToken.update({
      where: { id: payload.jti },
      data: { revokedAt: new Date() },
    });

    const tokens = this.issueTokens(user.id, user.tenantId!, user.role, user.email);
    const newRefreshToken = await this.issueRefreshToken(user.id, user.tenantId!);

    return { ...tokens, refreshToken: newRefreshToken };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  // Revokes the refresh token server-side, so it can't be used again even if
  // it was copied somewhere before the cookie is cleared. Best-effort: an
  // already-invalid token just means there's nothing left to revoke.
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload = this.jwt.verify<{ jti?: string }>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });

      if (payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Token already invalid/expired — nothing to revoke
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

  // ── Reset password ─────────────────────────────────────────────────────────
  // Completes the flow forgotPassword() starts. The frontend pulls
  // `access_token` out of the URL fragment Supabase redirects to (plain
  // string parsing — no Supabase client SDK needed on the frontend) and
  // posts it here along with the new password. We use the admin client to
  // both verify the token and set the new password, so no Supabase secrets
  // or session-handling logic need to live in the browser.
  async resetPassword(accessToken: string, newPassword: string): Promise<void> {
    const { data, error } = await this.supabaseAdmin.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException(
        'This reset link is invalid or has expired. Please request a new one.',
      );
    }

    const { error: updateError } = await this.supabaseAdmin.auth.admin.updateUserById(
      data.user.id,
      { password: newPassword },
    );

    if (updateError) {
      this.logger.error('Failed to update password', updateError);
      throw new InternalServerErrorException('Failed to reset password. Please try again.');
    }

    // A password reset is a strong signal to kill every other active
    // session — if the old password was compromised, anyone holding a
    // still-valid refresh token from before the reset should be logged out.
    const user = await this.prisma.user.findUnique({
      where: { authId: data.user.id },
      select: { id: true },
    });

    if (user) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.logger.log(`Password reset completed for auth user ${data.user.id}`);
  }

  // ── Resend verification email ──────────────────────────────────────────────
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true },
    });

    if (!user || user.emailVerifiedAt) return; // already verified or doesn't exist — no-op

    try {
      await this.supabaseAdmin.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: `${this.config.get('FRONTEND_URL')}/auth/verify-email` },
      });
    } catch (error) {
      this.logger.warn(`Failed to resend verification email to ${user.email}`, error);
    }
  }

  // ── Sync email verification status ─────────────────────────────────────────
  // Called by the frontend's /auth/verify-email landing page right after the
  // user clicks the confirmation link (while they're still logged into our
  // app from registration). Supabase confirms the email on its own redirect,
  // not through our API, so this is what actually pulls that state in.
  async syncEmailVerification(userId: string): Promise<{ emailVerified: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { authId: true, emailVerifiedAt: true },
    });

    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt) return { emailVerified: true };

    const { data, error } = await this.supabaseAdmin.auth.admin.getUserById(user.authId);

    if (error || !data.user?.email_confirmed_at) {
      return { emailVerified: false };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date(data.user.email_confirmed_at) },
    });

    return { emailVerified: true };
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
      { sub: userId, tenantId, role, email },
      {
        algorithm: 'HS256', // explicit — never allow algorithm confusion attacks
        expiresIn,
        secret: this.config.getOrThrow('JWT_SECRET'),
      },
    );

    return { accessToken, expiresIn };
  }

  private async issueRefreshToken(userId: string, tenantId: string): Promise<string> {
    const jti = randomUUID();
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresInMs = parseDurationToMs(expiresIn, 7 * 86_400_000);

    // Record this token server-side so it can be rotated/revoked later —
    // the JWT alone can't be invalidated before it expires.
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });

    return this.jwt.sign(
      {
        sub: userId,
        tenantId,
        type: 'refresh',
        jti,
      },
      {
        algorithm: 'HS256', // explicit — never allow algorithm confusion attacks
        expiresIn,
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      },
    );
  }
}
