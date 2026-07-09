import {
  Controller,
  Get,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── GET /api/v1/health ────────────────────────────────────────────────────
  // Lightweight liveness probe — is the Node process up?
  // Docker and load balancers hit this on every interval.
  // No auth required.
  @Public()
  @Get()
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? 'unknown',
    };
  }

  // ── GET /api/v1/health/ready ──────────────────────────────────────────────
  // Readiness probe — is the app ready to serve traffic?
  // Checks the database connection. If this returns 503, the load balancer
  // should stop routing to this instance.
  // Use this for Kubernetes readinessProbe and ECS health checks.
  // Docker compose healthcheck also uses /health (liveness) since compose
  // doesn't distinguish the two, but orchestrators with true readiness
  // support should prefer /health/ready.
  @Public()
  @Get('ready')
  async readiness() {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // ── DB check ─────────────────────────────────────────────────────────
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = {
        status: 'error',
        latencyMs: Date.now() - dbStart,
        error: 'Connection failed',
      };
      this.logger.error('Database health check failed', err instanceof Error ? err.message : String(err));
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok');

    if (!allOk) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      checks,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
