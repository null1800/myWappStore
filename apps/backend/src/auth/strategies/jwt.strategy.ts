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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      // Explicitly pin to HS256. Without this, passport-jwt accepts the
      // algorithm declared in the token header itself — an attacker who can
      // set alg:'none' could forge tokens without a signature.
      algorithms: ['HS256'],
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

    // Return value is attached to request.user — available in all guards and decorators.
    // IMPORTANT: use the freshly-fetched tenantId/role, not payload.tenantId/payload.role.
    // We already pay for this DB call to catch deactivated accounts immediately —
    // using the JWT's own (possibly stale) claims here would mean a role change
    // or tenant reassignment silently wouldn't take effect until the token expires.
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
  }
}
