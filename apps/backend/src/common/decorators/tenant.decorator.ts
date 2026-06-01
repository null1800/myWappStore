import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TenantContext {
  id: string;         // tenant UUID
  userId: string;     // user UUID
  role: string;       // OWNER | STAFF | SUPER_ADMIN
  email: string;
}

// Usage in controllers:
// @Get('products')
// async listProducts(@Tenant() tenant: TenantContext) {
//   return this.productsService.findAll(tenant.id);
// }
//
// The JWT payload is attached to request.user by JwtAuthGuard.
// This decorator extracts the tenant context from it.
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return {
      id: user.tenantId,
      userId: user.sub,
      role: user.role,
      email: user.email,
    };
  },
);
