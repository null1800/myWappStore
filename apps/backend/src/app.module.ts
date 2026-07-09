import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { ReportsModule } from './reports/reports.module';
import { StaffModule } from './staff/staff.module';
import { BillingModule } from './billing/billing.module';
import { CacheModule } from './common/cache/cache.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // ── Config — loads .env, available everywhere via ConfigService ──
    ConfigModule.forRoot({
      isGlobal: true,       // no need to import in every module
      envFilePath: '.env',
      cache: true,          // cache parsed values for performance
    }),

    // ── Rate limiting — 100 requests per 60 seconds per IP ──────────
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,  // 60 seconds in ms
          limit: 100,
        },
      ],
    }),

    // ── Core modules ─────────────────────────────────────────────────
    PrismaModule,
    AuthModule,
    StoresModule,
    ProductsModule,
    OrdersModule,
    CustomersModule,
    ReportsModule,
    StaffModule,
    BillingModule,
    CacheModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
