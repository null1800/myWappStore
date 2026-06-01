import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Use after JwtAuthGuard — JWT must already be validated.
// Usage:
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('OWNER')
// @Delete('products/:id')
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator means route is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user?.role) {
      throw new ForbiddenException('Access denied: no role assigned');
    }

    // SUPER_ADMIN bypasses all role checks
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied: requires ${requiredRoles.join(' or ')} role`,
      );
    }

    return true;
  }
}
