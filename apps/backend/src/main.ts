import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // ── Security headers ───────────────────────────────────────────
  app.use(helmet());

  // ── Cookie parser — required for HttpOnly refresh token cookie ─
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      // Add production domains here when deploying
    ],
    credentials: true, // required for HttpOnly cookie refresh tokens
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── API versioning — all routes prefixed /api/v1 ──────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Global validation pipe ─────────────────────────────────────
  // whitelist: strips properties not in the DTO (prevents mass assignment)
  // forbidNonWhitelisted: throws 400 if extra properties are sent
  // transform: auto-converts plain JS objects to DTO class instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Global exception filter + response interceptor ────────────
  // These wire in the files you already created
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`🚀 MyWAppStore API running on: http://localhost:${port}/api/v1`);
  console.log(`📦 Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
