import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

// This runs on every request that hits a @UseGuards(JwtAuthGuard) route.
// It extracts the Bearer token, verifies the signature, then calls validate().
// Whatever validate() returns is attached to request.user.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // Extract JWT from Authorization: Bearer <token> header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Reject expired tokens (do not ignore expiry)
      ignoreExpiration: false,

      // Must match the secret used to sign tokens in AuthService
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Called after signature verification succeeds.
  // payload = decoded JWT body: { sub, tenantId, role, email, iat, exp }
  async validate(payload: {
    sub: string;
    tenantId: string;
    role: string;
    email: string;
  }) {
    // Validate user still exists and is active
    // This adds a DB call per request but catches deactivated accounts immediately.
    // For high-traffic routes, you could skip this and rely on token expiry instead.
    const user = await this.authService.validateUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid. Please log in again.');
    }

    // Return value is attached to request.user — available in all guards and decorators
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
    };
  }
}
