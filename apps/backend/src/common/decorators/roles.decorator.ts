import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Usage:
// @Roles('OWNER')           → only store owners
// @Roles('OWNER', 'STAFF')  → owners and staff
// @Roles('SUPER_ADMIN')     → platform admins only
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
