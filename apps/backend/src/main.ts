import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger, BadRequestException } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const logger = new Logger('Bootstrap');

// ── Env validation ─────────────────────────────────────────────────────────
// Fail fast before the app binds to a port. A missing JWT_SECRET or Supabase
// key means the first authenticated request will crash — better to know at
// startup than to serve broken traffic for minutes before the first user hits it.
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
];

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Copy apps/backend/.env.example to apps/backend/.env and fill in real values.`,
    );
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnv();

  // rawBody: true is required to validate Paystack webhook HMAC signatures.
  const isProd = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL ?? (isProd ? 'warn' : 'debug');

  const logLevels: Record<string, ('error' | 'warn' | 'log' | 'debug' | 'verbose')[]> = {
    error:   ['error'],
    warn:    ['error', 'warn'],
    log:     ['error', 'warn', 'log'],
    debug:   ['error', 'warn', 'log', 'debug'],
    verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
  };

  const app = await NestFactory.create(AppModule, {
    logger: logLevels[logLevel] ?? logLevels.warn,
    rawBody: true,
  });

  // ── Security headers ───────────────────────────────────────────────────────
  // helmet() sets: X-DNS-Prefetch-Control, X-Frame-Options (SAMEORIGIN),
  // Strict-Transport-Security, X-Download-Options, X-Content-Type-Options,
  // X-Permitted-Cross-Domain-Policies, Referrer-Policy, X-XSS-Protection.
  // crossOriginResourcePolicy: false because the storefront fetches images
  // from Supabase Storage across origins — blocking CORP would break that.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Content-Security-Policy: helmet's default CSP is strict enough for an
      // API (no HTML served), but set explicitly so it's visible and auditable.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      // HSTS: 1 year, include subdomains, preload-ready
      strictTransportSecurity: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // ── JSON body parser ────────────────────────────────────────────────────────
  // When rawBody:true is set on NestFactory.create, NestJS uses express.raw()
  // to capture the raw buffer — this does NOT parse JSON into req.body.
  // We must explicitly register express.json() for all non-webhook routes.
  app.use(
    (req: any, _res: any, next: any) => {
      // Skip for the webhook which needs its own verify-capable parser below
      if (req.path?.startsWith('/api/v1/billing/webhook')) return next();
      json({ limit: '10mb' })(req, _res, next);
    },
  );
  app.use(
    (req: any, _res: any, next: any) => {
      if (req.path?.startsWith('/api/v1/billing/webhook')) return next();
      urlencoded({ extended: true })(req, _res, next);
    },
  );

  // ── Raw body preservation for Paystack webhook ─────────────────────────────
  // Applied to webhook path only; rawBody is read by the billing controller
  // for HMAC signature verification.
  app.use(
    '/api/v1/billing/webhook',
    json({
      type: 'application/json',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // ── Cookie parser ──────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────────────────────
  // credentials: true is required for the HttpOnly refresh token cookie to be
  // sent cross-origin. The origin list is explicit — '*' would break cookies.
  const allowedOrigins = [
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) { callback(null, true); return; }
      if (allowedOrigins.includes(origin)) { callback(null, true); return; }
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [],
    maxAge: 86_400, // preflight cache: 24 hours
  });

  // ── API versioning ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Global validation pipe ─────────────────────────────────────────────────
  // whitelist:            strips unknown properties (mass assignment protection)
  // forbidNonWhitelisted: throws 400 when unknown properties are sent
  // transform:            converts plain objects to DTO class instances
  // stopAtFirstError:     returns one validation error at a time (cleaner UX)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        console.error('[ValidationPipe] errors:', JSON.stringify(errors.map(e => ({ property: e.property, value: e.value, constraints: e.constraints })), null, 2));
        const msg = Object.values(errors[0]?.constraints ?? {})[0] ?? 'Validation failed';
        return new BadRequestException(msg);
      },
    }),
  );

  // ── Global exception filter + response interceptor ─────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`API running on port ${port} [${process.env.NODE_ENV ?? 'development'}]`);
}

bootstrap();
