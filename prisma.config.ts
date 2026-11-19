import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    // Prefer the direct (non-pooled) Neon connection for CLI commands such as
    // `prisma migrate deploy`; the app itself connects through the pooled
    // DATABASE_URL via the pg driver adapter.
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
