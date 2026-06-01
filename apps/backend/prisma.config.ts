import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7: config lives next to this package's package.json.
// Paths below are relative to this file (apps/backend/).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a direct Postgres connection (not the pooler URL).
    url: env('DIRECT_URL'),
  },
});
