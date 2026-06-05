import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/jwt-auth.guard';

// Use on routes that should be accessible without a JWT token.
// Works in combination with JwtAuthGuard.
//
// Example — public storefront route inside a guarded controller:
// @UseGuards(JwtAuthGuard)
// @Controller('stores')
// export class StoresController {
//
//   @Public()
//   @Get(':slug')               ← accessible without login
//   getPublicStore(...) {}
//
//   @Get('me')                  ← requires JWT
//   getMyStore(...) {}
// }
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
