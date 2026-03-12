# Empire Home Solutions

Next.js application for:

- paid landing pages under `/lp`, `/finance`, and `/about-trust`
- an internal Supabase-backed CRM under `/login`, `/dashboard`, and related CRM routes

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env:

```bash
cp .env.example .env.local
```

3. Add the required values to `.env.local`.

LP/public app:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CALL_NUMBER`
- `FORM_WEBHOOK_URL`
- `CONVERSION_API_SECRET`

CRM/Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`

4. Start the dev server:

```bash
npm run dev
```

## Main Routes

Public pages:

- `http://localhost:3000/`
- `http://localhost:3000/areas-we-cover`
- `http://localhost:3000/lp/boiler-repair/uxbridge`
- `http://localhost:3000/lp/boiler-repair/hayes`
- `http://localhost:3000/lp/boiler-installation/uxbridge`
- `http://localhost:3000/lp/boiler-installation/hayes`
- `http://localhost:3000/finance`
- `http://localhost:3000/about-trust`

CRM:

- `http://localhost:3000/login`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/leads`
- `http://localhost:3000/customers`
- `http://localhost:3000/jobs`
- `http://localhost:3000/calendar`
- `http://localhost:3000/quotes`
- `http://localhost:3000/invoices`
- `http://localhost:3000/settings`

## What This Branch Includes

Landing pages:

- service and location LP routing
- content loading and validation
- hero, pricing, coverage, FAQ, trust, and quote form modules
- attribution capture, GTM/GA4 hooks, JSON-LD, and lead submission API
- latest approved copy updates to logos, mobile form copy, and areas page messaging

CRM:

- Supabase auth-backed login flow
- protected CRM route group and session-aware layout
- dashboard, leads, customers, jobs, calendar, quotes, invoices, and settings screens
- API routes for CRM CRUD flows
- dynamic custom fields and required document rule support
- private storage support for CRM attachments
- Supabase migrations for schema, seed data, admin bootstrap, and API exposure

## Supabase Notes

The CRM expects a dedicated `crm` schema in Supabase and the migrations in `supabase/migrations` to be applied.

The current implementation uses:

- publishable key in browser/server session clients
- service role key for admin-only server operations such as storage
- row-level security policies on CRM tables

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Docs

- `docs/crm-prd.md`
- `docs/paid-lp-foundation-task-list.md`
- `docs/reporting-dashboard-spec.md`
- `docs/deployment-pipeline.md`
- `docs/lp-ops.md`
- `docs/lp-qa-checklist.md`
