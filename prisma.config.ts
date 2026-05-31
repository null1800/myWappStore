import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Path to your Prisma schema file
  schema: "./apps/backend/prisma/schema.prisma",
  // Datasource configuration – Prisma will read DATABASE_URL from .env
  datasource: {
    url: process.env.DATABASE_URL,
  },
  // Optional: you can customize the generator output location here
  // generator: {
  //   provider: "prisma-client-js",
  //   output: "./apps/backend/src/generated/prisma",
  // },
});
