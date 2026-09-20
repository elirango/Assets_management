# ניהול נכסים — Property Management MVP

Mobile-first, Hebrew/RTL property-management app: properties, tenants, expenses & repairs, and a reminders dashboard (check deposits, contract end dates, meter readings).

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · Tailwind CSS 4 · Prisma 7 · Vercel Postgres (via `@prisma/adapter-pg`)

Deploying? See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## Quick start

The app talks to Vercel Postgres in every environment, so you need the project linked to Vercel first (steps 1–3 of the deployment guide).

```bash
npm install            # also runs `prisma generate`
npx vercel link        # once
npx vercel env pull    # writes .env.local with POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING
npm run db:push        # create the tables
npm run db:seed        # optional sample data
npm run dev            # http://localhost:3000
```

## Scripts

| Script               | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Dev server (Turbopack)                         |
| `npm run build`      | Production build                               |
| `npm run lint`       | ESLint                                         |
| `npm run typecheck`  | `tsc --noEmit`                                 |
| `npm run db:push`    | Sync the schema to the database (`prisma db push`) |
| `npm run db:seed`    | Load sample data (`prisma/seed.ts`)            |
| `npm run db:migrate` | Create/apply a migration (`prisma migrate dev`) |
| `npm run db:studio`  | Browse the DB in Prisma Studio                 |

## Project layout

```
prisma/
  schema.prisma          # Property, Tenant, Expense, Reminder, Charge, MeterReading
  seed.ts                # Sample data (idempotent)
src/
  app/                   # App Router pages (all server-rendered, dynamic)
    page.tsx             # Dashboard: stats, upcoming reminders, ending contracts, recent expenses
    properties/          # list · new · [id] (detail) · [id]/edit
    tenants/             # list · new · [id] (detail: meter calculator, unpaid charges) · [id]/edit
    expenses/            # list (filter by property) · new · [id]/edit
    reminders/           # list (open / done) · new · [id]/edit
  components/
    app-shell.tsx        # Bottom tab bar (mobile) / sidebar (desktop)
    ui.tsx               # Button, Input, Select, Field, Card, Badge, EmptyState…
    reminder-list.tsx    # Shared reminder list with done-toggle + delete
    forms/               # Client forms using useActionState
  lib/
    prisma.ts            # Lazy PrismaClient singleton (pg adapter, pooled URL)
    constants.ts         # Enum-like values + Hebrew labels (single source of truth)
    form.ts              # FormData parsing helpers + ActionState
    format.ts            # he-IL date/currency formatting
    meters.ts            # Utility bill formula ((current − previous) × rate + fixed fee)
    charges.ts           # Manual HOA / property-tax charges (months × monthly rate)
    contract.ts          # Contract end default + monthly cheque reminder schedule (UTC-safe)
    actions/             # Server actions: create / update / delete per entity
```

## Conventions

- **RTL:** `<html lang="he" dir="rtl">`; use Tailwind logical utilities (`ms-`, `me-`, `ps-`, `text-start`, `start-0`) instead of left/right.
- **Database URLs:** the app reads `POSTGRES_PRISMA_URL` (pooled); the Prisma CLI and seed read `POSTGRES_URL_NON_POOLING` (direct) from `prisma.config.ts`. Both fall back to `DATABASE_URL`. `.env.local` (from `vercel env pull`) takes precedence over `.env`.
- **Enums** are stored as strings and validated against the maps in `src/lib/constants.ts`.
- **Dates** from `<input type="date">` are stored as UTC midnight and formatted in UTC to avoid off-by-one shifts.
- **Forms:** server actions return `{ error, values }` on validation failure; forms re-seed inputs from `values` because React resets the form after an action.
- **Contracts:** `src/lib/contract.ts` derives the end date from a start date and a duration in months (default 12; "משך חוזה" in the form, not stored) as start + N months − 1 day, month-end aware, plus the cheque schedule (one `CHECK_DEPOSIT` reminder per month on the tenant's `paymentDay`, 1–31 clamped to short months, default 10) and one renewal reminder (`CONTRACT_END`, "חידוש חוזה - <name>") 60 days before the end. All created with the tenant in one transaction; editing the period replaces the tenant's open cheque and renewal reminders.
- **Utility bills:** the meter calculator on the tenant page saves a `MeterReading` and its `Charge` in one transaction; the fixed fee applies to electricity only. HOA (ועד בית, default ₪40/month) and property-tax (ארנונה) charges are added by hand as months × rate. Charges stay listed until marked paid.
- **Deletes:** `Property` cascades to its expenses and reminders; tenants are detached (`propertyId = null`).
