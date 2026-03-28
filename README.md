# Empire Home Solutions

Next.js application for:

- paid landing pages under `/lp`, `/finance`, and `/about-trust`
- a Supabase-backed multi-tenant CRM SaaS under `/login`, `/signup`, `/dashboard`, and related CRM routes

## CRM Scope

The CRM is no longer a single-business Empire-only workspace. It now supports:

- multi-tenant tenancy with Empire Home Solutions preserved as tenant one
- tenant-scoped auth, memberships, branding, settings, numbering, storage paths, and workspace switching
- public workspace signup plus admin-assisted tenant creation
- structured customer sites and site contacts
- multi-engineer job assignment
- job phases and variations
- quote vs estimate workflows with version history and acceptance capture
- staged invoice schedules, invoice generation, and payment tracking
- hazards, checklists, certificates, purchase orders, and supplier reconciliation
- demo bootstrap and live smoke coverage against the linked backend

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
- `http://localhost:3000/signup`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/leads`
- `http://localhost:3000/customers`
- `http://localhost:3000/jobs`
- `http://localhost:3000/calendar`
- `http://localhost:3000/quotes`
- `http://localhost:3000/invoices`
- `http://localhost:3000/staff`
- `http://localhost:3000/reports`
- `http://localhost:3000/settings`

## What This Branch Includes

Landing pages:

- service and location LP routing
- content loading and validation
- hero, pricing, coverage, FAQ, trust, and quote form modules
- attribution capture, GTM/GA4 hooks, JSON-LD, and lead submission API
- latest approved copy updates to logos, mobile form copy, and areas page messaging

CRM:

- multi-tenant auth-backed login and public signup flow
- protected CRM route group and tenant-aware session/layout resolution
- dashboard, leads, customers, jobs, calendar, quotes, invoices, staff, reports, and settings screens
- API routes for CRM CRUD, reporting, staff, catalog, onboarding, demo mode, and attachment flows
- dynamic custom fields and required document rule support
- private storage support for CRM attachments
- signed attachment access and grouped private file handling
- staff directory and certification tracking
- reporting summary and workload views
- production-safe demo mode with seeded demo data and guided replay
- Supabase migrations for tenancy, sites/site contacts, job assignees, phases, variations, quote versions, quote acceptance, invoice schedules, compliance workflows, supplier control, and RLS hardening
- live smoke coverage for route protection, role permissions, feature workflows, demo bootstrap, and tenant isolation

## Supabase Notes

The CRM expects a dedicated `crm` schema in Supabase and the migrations in `supabase/migrations` to be applied.

The current implementation uses:

- publishable key in browser/server session clients
- service role key for admin-only server operations such as storage
- row-level security policies on CRM tables
- tenant-scoped helpers and policies for cross-workspace isolation

Empire Home Solutions is the seeded first tenant. New workspaces can be created from:

- `http://localhost:3000/signup`
- `http://localhost:3000/settings` as a management/admin user

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run crm:smoke:routes`
- `npm run crm:smoke:remote`
- `npm run crm:smoke:features`
- `npm run crm:demo:bootstrap`
- `npm run crm:smoke:demo`

## Demo Mode

- Start from the CRM header as a management/admin user.
- Demo mode is read-only and uses dedicated demo-tagged records in the real backend.
- The walkthrough now drills into seeded customer, job, quote, and invoice records instead of only list pages.
- Use `npm run crm:demo:bootstrap` to ensure the demo dataset and demo auth-linked profiles exist.
- Live mode and demo mode keep staff data separate. Engineer assignment dropdowns only show active staff profiles with the `engineer` role in the current mode.

## Docs

- `docs/crm-prd.md`
- `docs/crm-saas-fergus-launch-prd.md`
- `docs/crm-prod-readiness.md`
- `docs/paid-lp-foundation-task-list.md`
- `docs/reporting-dashboard-spec.md`
- `docs/deployment-pipeline.md`
- `docs/lp-ops.md`
- `docs/lp-qa-checklist.md`
