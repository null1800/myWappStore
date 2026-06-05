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
import { type Response, type Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Tenant, type TenantContext } from '../common/decorators/tenant.decorator';

// All routes: /api/v1/auth/...
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ── POST /api/v1/auth/register ────────────────────────────────────────────
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

    const tokens = await this.authService.refresh(refreshToken);

    return tokens;
  }

  // ── POST /api/v1/auth/logout ──────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Res({ passthrough: true }) res: Response) {
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
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    await this.authService.forgotPassword(email);

    // Always return the same message — never reveal if email exists
    return {
      message: 'If an account exists with this email, you will receive a password reset link.',
    };
  }

  // ── GET /api/v1/auth/me ────────────────────────────────────────────────────
  // Useful for the frontend to verify session and get current user info
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Tenant() tenant: TenantContext) {
    return {
      userId: tenant.userId,
      tenantId: tenant.id,
      role: tenant.role,
      email: tenant.email,
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
