# Deployment Guide — Vercel + Vercel Postgres

Five steps, in order. Every command is run from the project root (`Assets_management/`).

Prerequisites: a [Vercel account](https://vercel.com/signup), Node.js 20+, and the project pushed to a Git repository (GitHub / GitLab / Bitbucket). The Vercel CLI is invoked with `npx vercel`, so nothing needs to be installed globally.

> **How the app connects:** Vercel Postgres exposes two connection strings. The app uses the pooled one (`POSTGRES_PRISMA_URL`) at runtime; the Prisma CLI and the seed script use the direct one (`POSTGRES_URL_NON_POOLING`). Both are read automatically — you never paste them into code.

---

## Step 1 — Create the project on Vercel

**Option A: Web (recommended for the first deploy)**

1. Go to <https://vercel.com/new>.
2. Pick your Git provider and **Import** the `Assets_management` repository.
3. Leave *Framework Preset* as **Next.js** and *Root Directory* as `./`. Do not change the build command — `package.json` already runs `prisma generate && next build`.
4. Click **Deploy**. This first build will finish, but pages will error at runtime until Step 2 — that is expected.

**Option B: CLI**

```bash
npx vercel
```

Answer the prompts: *Set up and deploy?* → **Y**, pick your scope, *Link to existing project?* → **N**, accept the detected settings. This creates the project and does a preview deploy.

✅ **Check:** the project appears in your Vercel dashboard at `https://vercel.com/<your-team>/assets-management`.

---

## Step 2 — Provision Vercel Postgres in the Storage tab

1. Open the project in the Vercel dashboard → **Storage** tab → **Create Database**.
2. Choose **Postgres** (provided by Neon on the Vercel Marketplace) → **Continue**.
3. Pick the region closest to your users (e.g. **Frankfurt (fra1)** for Israel), keep the default plan, and click **Create**.
4. On the *Connect Project* dialog, keep **all environments** (Production, Preview, Development) selected and the environment-variable prefix as the default, then click **Connect**.

Vercel now injects the database variables into the project — including the two the app expects:

| Variable                   | Used by                                   |
| -------------------------- | ----------------------------------------- |
| `POSTGRES_PRISMA_URL`      | The app at runtime (pooled connection)    |
| `POSTGRES_URL_NON_POOLING` | Prisma CLI + `prisma/seed.ts` (direct)    |

✅ **Check:** Project → **Settings** → **Environment Variables** lists `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`.

---

## Step 3 — Link the project locally and pull the environment

```bash
npx vercel link
```

*Set up "…/Assets_management"?* → **Y** → choose your scope → *Link to existing project?* → **Y** → select **assets-management**. This writes a `.vercel/` folder (already git-ignored).

```bash
npx vercel env pull
```

This downloads the Development environment variables into **`.env.local`** (git-ignored). The Prisma config and the seed script load `.env.local` automatically, so no further wiring is needed.

✅ **Check:** `.env.local` exists and contains `POSTGRES_PRISMA_URL=` and `POSTGRES_URL_NON_POOLING=` lines.

---

## Step 4 — Apply the Prisma migrations to the production database

```bash
npx prisma migrate deploy
```

Prisma reads `POSTGRES_URL_NON_POOLING` from `.env.local` (via `prisma.config.ts`) and applies every migration in `prisma/migrations`. Expected output ends with:

```
All migrations have been successfully applied.
```

Optional — load the sample property/tenant/reminders:

```bash
npx prisma db seed
```

✅ **Check:** `npx prisma studio` opens a browser showing the four tables (empty, or with the seeded rows).

> If you enabled a separate Preview/Development database in Step 2, repeat `npx vercel env pull --environment=production` + `npx prisma migrate deploy` once for Production. With the default single-database setup there is nothing extra to do.

---

## Step 4b — Authentication variables

The app requires Google sign-in. In Vercel → Project → **Settings → Environment Variables** add, for Production (and Preview if you use it):

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth client (Web application) from Google Cloud Console → APIs & Services → Credentials; add `https://<your-domain>/api/auth/callback/google` as an authorized redirect URI |
| `ADMIN_EMAIL` | Google account with full access |
| `VIEWER_EMAIL` | Google account with read-only access |

Or from the CLI: `npx vercel env add AUTH_SECRET production` (repeat per variable), then `npx vercel env pull` locally.

## Step 4c — Daily reminder email (Vercel Cron + Resend)

`vercel.json` schedules `GET /api/cron/reminders` every day at 06:00 UTC (08:00/09:00 Israel time). The route emails `ADMIN_EMAIL` a Hebrew digest of cheques due tomorrow or overdue, plus contract renewals due within 60 days (each renewal is repeated at most once a week via `Reminder.lastReminderSentAt`). Add to Production:

| Variable | Value |
| --- | --- |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — Vercel Cron sends it automatically as `Authorization: Bearer <CRON_SECRET>`; the route refuses everything else |
| `RESEND_API_KEY` | API key from [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM` (optional) | Sender address. Defaults to `onboarding@resend.dev`, which Resend only delivers to the email that owns the Resend account — so sign up to Resend with `ADMIN_EMAIL`, or verify a domain and set e.g. `ניהול נכסים <reminders@your-domain.com>` |
| `APP_URL` (optional) | Public URL for the "open the app" button; falls back to Vercel's `VERCEL_PROJECT_PRODUCTION_URL` |

Cron jobs only run on production deployments. To trigger a run by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/reminders
```

The JSON response reports `checkDeposits`, `contractRenewals`, whether an email was `sent`, and the Resend `emailId`. Runs are also listed under Vercel → Project → **Settings → Cron Jobs**.

## Step 5 — Deploy to production

```bash
npx vercel --prod
```

Vercel installs dependencies (running `prisma generate` via `postinstall`), builds the app, and prints the production URL, e.g. `https://assets-management.vercel.app`.

✅ **Check:** open the URL — the dashboard (לוח בקרה) loads, and creating a property from **+ נכס** succeeds. From now on, every push to your default branch redeploys production automatically; other branches get preview deployments.

---

### Troubleshooting

| Symptom                                                        | Fix                                                                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Missing database URL. Set POSTGRES_PRISMA_URL…` in Vercel logs | Storage database is not connected to the project (Step 2, "Connect Project"), or the deploy happened before it was connected — redeploy. |
| `prisma migrate deploy` says `Environment variable not found`  | Run `npx vercel env pull` again from the project root and confirm `.env.local` has `POSTGRES_URL_NON_POOLING`.              |
| `relation "Property" does not exist` at runtime                 | Step 4 was skipped or ran against a different database — run `npx prisma migrate deploy` with the production variables.            |
| Local `npm run dev` cannot connect                              | You need `.env.local` from Step 3; the app no longer uses SQLite.                                                            |
