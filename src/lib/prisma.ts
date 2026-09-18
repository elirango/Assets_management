import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter. The app talks to Postgres through the POOLED
// connection string (PgBouncer) that Vercel Postgres exposes as POSTGRES_PRISMA_URL.
//
// The client is created lazily on first use and cached on globalThis:
//  - `next build` imports these modules without a database, so nothing must connect at import time;
//  - Next.js hot reloads and warm serverless invocations reuse the same pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDatabaseUrl(): string {
  const url = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing database URL. Set POSTGRES_PRISMA_URL (Vercel Postgres) or DATABASE_URL — see DEPLOYMENT_GUIDE.md.",
    );
  }
  return url;
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
    // Serverless functions are short-lived; keep the per-instance pool small and let
    // the pooled endpoint do the real connection management.
    max: 5,
  });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  return (globalForPrisma.prisma ??= createClient());
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
