import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Queries slower than this threshold get logged as warnings so they're
// visible in production logs and can be identified for optimization.
const SLOW_QUERY_THRESHOLD_MS = 500;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });

    // Log slow queries as warnings — the event was wired but the handler was
    // never attached, so slow queries were silently going unnoticed.
    // Only log in non-production to avoid flooding logs with normal traffic;
    // in production only log queries above the slow threshold.
    (this as any).$on('query', (e: { query: string; duration: number }) => {
      if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn(
          `Slow query (${e.duration}ms): ${e.query.slice(0, 200)}`,
        );
      } else if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Query (${e.duration}ms): ${e.query.slice(0, 120)}`);
      }
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  // ── Helper: clean pagination params ───────────────────────────────────────
  getPaginationParams(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    return {
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    };
  }
}
