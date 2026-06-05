import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

export const IS_PUBLIC_KEY = 'isPublic';

// Apply to any route that requires a valid JWT:
// @UseGuards(JwtAuthGuard)
//
// To make a route inside a guarded controller public, use:
// @Public()
// @Get('public-route')
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked @Public() — skip auth if so
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  // Override default Passport error to return our standard error format
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    info: { message?: string },
  ): TUser {
    if (err || !user) {
      const message =
        info?.message === 'jwt expired'
          ? 'Your session has expired. Please log in again.'
          : info?.message === 'No auth token'
            ? 'Authentication required. Please log in.'
            : 'Invalid or missing authentication token.';

      throw new UnauthorizedException(message);
    }

    return user;
  }
}
