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

## Step 4 — Push the Prisma schema to the production database

```bash
npx prisma db push
```

Prisma reads `POSTGRES_URL_NON_POOLING` from `.env.local` (via `prisma.config.ts`) and creates the `Property`, `Tenant`, `Expense`, and `Reminder` tables. Expected output ends with:

```
Your database is now in sync with your Prisma schema.
```

Optional — load the sample property/tenant/reminders:

```bash
npx prisma db seed
```

✅ **Check:** `npx prisma studio` opens a browser showing the four tables (empty, or with the seeded rows).

> If you enabled a separate Preview/Development database in Step 2, repeat `npx vercel env pull --environment=production` + `npx prisma db push` once for Production. With the default single-database setup there is nothing extra to do.

---

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
| `prisma db push` says `Environment variable not found`         | Run `npx vercel env pull` again from the project root and confirm `.env.local` has `POSTGRES_URL_NON_POOLING`.              |
| `relation "Property" does not exist` at runtime                 | Step 4 was skipped or ran against a different database — run `npx prisma db push` with the production variables.            |
| Local `npm run dev` cannot connect                              | You need `.env.local` from Step 3; the app no longer uses SQLite.                                                            |
