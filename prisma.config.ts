import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig, env } from "prisma/config";

// Load backend .env when running Prisma from monorepo root
config({ path: resolve(__dirname, "apps/backend/.env") });

export default defineConfig({
  // Path to your Prisma schema file
  schema: "./apps/backend/prisma/schema.prisma",
  migrations: {
    path: "./apps/backend/prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
  // Optional: you can customize the generator output location here
  // generator: {
  //   provider: "prisma-client-js",
  //   output: "./apps/backend/src/generated/prisma",
  // },
});
