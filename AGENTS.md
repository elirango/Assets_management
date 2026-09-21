<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Hebrew UI, RTL (`dir="rtl"` on `<html>`). Use Tailwind logical utilities (`ms-`/`me-`/`ps-`/`text-start`), never `ml-`/`mr-`/`text-left`.
- Prisma 7 + Postgres (Vercel Postgres) via `@prisma/adapter-pg`; client is generated to `src/generated/prisma` (gitignored) — run `npm run db:generate` after schema changes. Schema changes go through migrations now (`prisma/migrations`, baselined as `0_init`): write the SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, then `npx prisma migrate deploy`. Do not use `db push` or `migrate reset` against the shared database.
- Env: app uses `POSTGRES_PRISMA_URL`, CLI/seed use `POSTGRES_URL_NON_POOLING`; both come from `npx vercel env pull` → `.env.local`. `src/lib/prisma.ts` is a lazy proxy so `next build` works without a DB.
- Auth: next-auth v5 (Google) in `src/lib/auth.ts`; only `ADMIN_EMAIL` / `VIEWER_EMAIL` may sign in, role is re-derived from env on every JWT refresh. `src/proxy.ts` redirects signed-out users to `/login` and keeps viewers off `/new` + `/edit`. Every mutating server action starts with `await requireAdmin()` (`src/lib/authz.ts`, throws `UnauthorizedError`); pages compute `canEdit = await isAdmin()` and hide create/update/delete UI for viewers (`readOnly` on `ReminderList` / `ChargeList`). Create/edit pages call `requireAdminPage()`.
- Enum-like columns are plain strings validated against `src/lib/constants.ts`, which also holds the Hebrew labels.
- Server actions live in `src/lib/actions/*`; on validation failure return `failure(message, formData)` so forms keep the typed values.
- Dashboard (`/`): next 3 open reminders from today, contracts ending within 60 days, every unpaid charge. Quick actions reuse `toggleReminderDone` / `deleteReminder` / `toggleChargePaid` / `deleteCharge`, all of which `revalidatePath("/")`. Lists are shared components: `reminder-list.tsx`, `charge-list.tsx`.
- See README.md for layout and conventions.
- Contract rules live in `src/lib/contract.ts` (pure, UTC-only, shared by client + server): default end = start + `contractMonths` (form field, not stored; default 12, 1–120) − 1 day, month-end aware; saving a tenant creates one `CHECK_DEPOSIT` reminder per month on `Tenant.paymentDay` (1–31, clamped to the month length, default 10) inside the contract plus one `CONTRACT_END` renewal reminder ("חידוש חוזה - <name>") 60 days before the end (update with a changed period replaces the tenant's *open* cheque + renewal reminders; delete removes all of the tenant's reminders).
- Daily email digest: Vercel Cron (`vercel.json`, 06:00 UTC) → `GET /api/cron/reminders` (guarded by `Authorization: Bearer ${CRON_SECRET}`, excluded from `src/proxy.ts`) → Resend to `ADMIN_EMAIL`. Rules + Hebrew HTML live in `src/lib/reminderDigest.ts` (pure, UTC): CHECK_DEPOSIT due ≤ tomorrow; CONTRACT_END due ≤ 60 days out and not emailed in the last 7 days (`Reminder.lastReminderSentAt`, stamped only for renewals, only after a successful send). Env: `CRON_SECRET`, `RESEND_API_KEY`, optional `RESEND_FROM` / `APP_URL`.
- Utility bills: `src/lib/meters.ts` computes `((current − previous) × rate) + fixedFee` (fixed fee only for ELECTRICITY, money rounded to 2 dp); `createMeterReading` writes the `MeterReading` and a `Charge` ("חיוב חשמל - MM/YYYY") in one transaction. Manual HOA/tax charges: `src/lib/charges.ts` (months × rate, description "ועד בית, 3 חודשים"), action `createManualCharge`. Tenant detail page is `/tenants/[id]` (meter calculator + add-charge form + unpaid charges with selection → WhatsApp payment message + recent readings). `src/lib/messageGenerator.ts` builds the he/en message; `attachMeterReadings` pairs a meter Charge with its MeterReading by tenant + date + amount + type (no FK in the schema).
