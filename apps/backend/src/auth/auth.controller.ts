import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type Response, type Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';
import { PrismaService } from '../prisma/prisma.service';

// All routes: /api/v1/auth/...
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── POST /api/v1/auth/register ────────────────────────────────────────────
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);

    // Note: register doesn't set a refresh token cookie.
    // The user should log in after registration to get the refresh cookie.
    // This keeps register simple and stateless.

    return result;
  }

  // ── POST /api/v1/auth/login ───────────────────────────────────────────────
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { response, refreshToken } = await this.authService.login(dto);

    // Store refresh token in HttpOnly cookie — never accessible to JavaScript
    // This protects against XSS stealing the refresh token
    this.setRefreshCookie(res, refreshToken);

    return response;
  }

  // ── POST /api/v1/auth/refresh ─────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Read refresh token from HttpOnly cookie (not request body)
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found. Please log in again.');
    }

    const { accessToken, expiresIn, refreshToken: rotatedToken } =
      await this.authService.refresh(refreshToken);

    // Rotation: the old refresh token is now revoked server-side, so the
    // cookie must be replaced with the new one or the next refresh will fail.
    this.setRefreshCookie(res, rotatedToken);

    return { accessToken, expiresIn };
  }

  // ── POST /api/v1/auth/logout ──────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Revoke the refresh token server-side — clearing the cookie alone
    // doesn't stop the token from being used if it was copied elsewhere.
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    await this.authService.logout(refreshToken);

    // Clear the refresh token cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  // ── POST /api/v1/auth/forgot-password ────────────────────────────────────
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    await this.authService.forgotPassword(email);

    // Always return the same message — never reveal if email exists
    return {
      message: 'If an account exists with this email, you will receive a password reset link.',
    };
  }

  // ── POST /api/v1/auth/reset-password ─────────────────────────────────────
  // Completes the forgot-password flow. accessToken comes from the URL
  // fragment of the Supabase recovery email redirect (parsed client-side).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.accessToken, dto.newPassword);
    return { message: 'Your password has been reset. Please log in with your new password.' };
  }

  // ── POST /api/v1/auth/resend-verification ────────────────────────────────
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async resendVerification(@Tenant() tenant: TenantContext) {
    await this.authService.resendVerificationEmail(tenant.userId);
    return { message: 'Verification email sent — check your inbox.' };
  }

  // ── POST /api/v1/auth/sync-email-verification ────────────────────────────
  // Called by the /auth/verify-email landing page right after the user
  // clicks the confirmation link, to pull the now-confirmed status in from
  // Supabase (which doesn't call back into our API on its own).
  @Post('sync-email-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async syncEmailVerification(@Tenant() tenant: TenantContext) {
    return this.authService.syncEmailVerification(tenant.userId);
  }

  // ── GET /api/v1/auth/me ────────────────────────────────────────────────────
  // Useful for the frontend to verify session and get current user info
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Tenant() tenant: TenantContext) {
    // Fresh read for emailVerified — the JWT doesn't carry this claim (it
    // would go stale the same way role/tenantId would; see jwt.strategy.ts),
    // and this endpoint is cheap/low-traffic enough to afford the lookup.
    const user = await this.prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { emailVerifiedAt: true },
    });

    return {
      userId: tenant.userId,
      tenantId: tenant.id,
      role: tenant.role,
      email: tenant.email,
      emailVerified: !!user?.emailVerifiedAt,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, token: string) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    res.cookie('refresh_token', token, {
      httpOnly: true,          // not accessible to JavaScript — XSS protection
      secure: isProd,          // HTTPS only in production
      sameSite: 'lax',         // CSRF protection
      maxAge: sevenDays,
      path: '/',
    });
  }
}
