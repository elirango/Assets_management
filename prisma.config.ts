import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// `vercel env pull` writes .env.local; a plain .env is still honoured as a fallback.
// First file wins for duplicate keys, so .env.local takes precedence.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (db push / migrate / studio) must use the DIRECT, non-pooled connection.
    url: process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["DATABASE_URL"],
  },
});
