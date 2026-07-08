# Project Cookbook

Next.js 14 (App Router) + TypeScript scaffold with Tailwind CSS, shadcn/ui, and a Railway Postgres database. No auth — single-tenant.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your Railway Postgres connection string:

- `DATABASE_URL` — from Railway → your Postgres service → Connect → "Postgres Connection URL"

## Database

Apply the schema in `migrations/` to your Railway database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260708120000_init_schema.sql
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — build for production
- `npm run start` — run the production build
- `npm run lint` — lint the project

## Structure

- `app/` — routes and pages (App Router)
- `components/` — React components (shadcn/ui components go in `components/ui`)
- `lib/db.ts` — Postgres client (`postgres.js`), reads `DATABASE_URL`
- `migrations/` — plain SQL schema migrations, applied by hand with `psql`
- `types/` — shared TypeScript types
