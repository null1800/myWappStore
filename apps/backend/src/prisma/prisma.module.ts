import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global means you import PrismaModule once in AppModule
// and PrismaService is injectable everywhere — no need to import
// PrismaModule in AuthModule, ProductsModule, etc.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
