<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Hebrew UI, RTL (`dir="rtl"` on `<html>`). Use Tailwind logical utilities (`ms-`/`me-`/`ps-`/`text-start`), never `ml-`/`mr-`/`text-left`.
- Prisma 7 + Postgres (Vercel Postgres) via `@prisma/adapter-pg`; client is generated to `src/generated/prisma` (gitignored) — run `npm run db:generate` after schema changes, `npm run db:push` to sync the DB. No migrations folder yet (schema is applied with `db push`).
- Env: app uses `POSTGRES_PRISMA_URL`, CLI/seed use `POSTGRES_URL_NON_POOLING`; both come from `npx vercel env pull` → `.env.local`. `src/lib/prisma.ts` is a lazy proxy so `next build` works without a DB.
- Enum-like columns are plain strings validated against `src/lib/constants.ts`, which also holds the Hebrew labels.
- Server actions live in `src/lib/actions/*`; on validation failure return `failure(message, formData)` so forms keep the typed values.
- See README.md for layout and conventions.
- Contract rules live in `src/lib/contract.ts` (pure, UTC-only, shared by client + server): default end = start + 1 year − 1 day; saving a tenant creates one `CHECK_DEPOSIT` reminder per month on `Tenant.paymentDay` (1–31, clamped to the month length, default 10) inside the contract (update with a changed period replaces the tenant's *open* cheque reminders; delete removes all of the tenant's reminders).
- Utility bills: `src/lib/meters.ts` computes `((current − previous) × rate) + fixedFee` (fixed fee only for ELECTRICITY, money rounded to 2 dp); `createMeterReading` writes the `MeterReading` and a `Charge` ("חיוב חשמל - MM/YYYY") in one transaction. Tenant detail page is `/tenants/[id]` (calculator + unpaid charges + recent readings).
