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

Current Empire tenant state:

- tenant 1 (`Empire Home Solutions`) is now production-only; tenant-level demo mode is disabled there
- the public Empire website lead form writes into tenant 1 CRM
- seeded non-demo admin/engineer roleplay jobs are available in tenant 1 so office and field users can exercise the same live workflow
- tenant 1 can be reset to a realistic 14-day production scenario set with `node scripts/tenant1-production-scenarios-seed.mjs`

### Agentic Front Desk Status

The CRM is now wired to the live CustomerJourneys runtime for tenant-linked front-desk testing.

Current validated behavior (as of April 16, 2026):

- `/ai-hub/live` opens real webchat sessions against the linked runtime
- SMS, WhatsApp, and Phone readiness are shown from the runtime link record
- runtime conversations publish platform events back into CRM through `/api/platform/events`
- strict booking confirmation is enforced per session before a booking is confirmed
- confirmed conversations materialize into CRM link, event, command, and appointment records
- **voice channel at full parity**: ElevenLabs managed-voice bookings publish `BookingConfirmed` events through the same platform-events path; voice bookings appear in CRM autonomously with no manual intervention
- all four channels (webchat, SMS, WhatsApp, voice) confirmed to produce identical CRM outcomes
- **[2026-04-16] CRM ingestion hardened**: `LinkConversationToCustomerOrJob` now runs before `CreateOrUpdateAppointment` on every `BookingConfirmed` event, and the appointment handler self-heals when `customer_id` is missing — no more orphaned bookings that sit in platform state but fail to reach the engineer diary
- **[2026-04-16] Engineer auto-assignment**: CustomerJourneys now sends `booking_resource_id` + `booking_resource_name` on `BookingConfirmed`, so the correct engineer is set on the diary job at ingestion time instead of requiring a manual reassign
- **[2026-04-16] Diary time display fix** (`src/modules/crm/lib/format.ts`): scheduled times now render in `Europe/London` (BST/GMT) instead of UTC, so the engineer diary matches the booking confirmation SMS/email the customer received
- Live validation: `scripts/live-empire-channel-tests.mts` — 6/6 end-to-end channel scenarios passing against production CustomerJourneys runtime

Current local operator setup:

- local CRM: `http://127.0.0.1:3000`
- runtime event bridge: active through a Cloudflare tunnel to the local CRM
- live runtime health: `https://customerjourneys-platform-api-424400851565.europe-west2.run.app/health`

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
- `http://localhost:3000/diary` (engineer — daily schedule)
- `http://localhost:3000/preferences` (engineer — UI mode toggle)

Live CRM:

- `https://empire-home-solutions.vercel.app/login`
- `https://empire-home-solutions.vercel.app/signup`
- `https://empire-home-solutions.vercel.app/dashboard`

Live front-desk test surface:

- `http://localhost:3000/ai-hub/live`
- `http://localhost:3000/inbox`

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
- production hardening for website lead intake, duplicate-review metadata, and safer customer matching
- production-only tenant-1 configuration with real admin/engineer roleplay data
- engineer job-note and attachment form handling validated end-to-end on live tenant-1 jobs
- reusable tenant-1 production scenario seeding for buyer roleplay with realistic customers, leads, jobs, appointments, quotes, invoices, compliance records, and purchase orders
- Commusoft-style engineer field app UI: engineers log in to a streamlined mobile-first view with a diary, job event detail, Arrive/No Access/Abort/Leave workflow, and a mandatory-checklist Leave Questions modal; engineers can switch to the classic CRM view from `/preferences`
- `no_access` and `aborted` job statuses added to the workflow
- compliance tables (`job_checklists`, `job_hazards`, `job_certificates`, `purchase_orders`, `supplier_reconciliation`) now carry `is_demo` / `demo_scenario_key` columns so demo-mode filtering works correctly for all compliance data
- tenant-scoped job report question templates in Settings; active questions are auto-added to new jobs as mandatory checklists, and existing live jobs without mandatory checklists are backfilled from the tenant defaults

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

For Empire tenant 1 specifically:

- demo mode is disabled
- the public landing-page lead flow is wired into this tenant
- production roleplay validation has been run with real non-demo admin + engineer accounts against shared live jobs

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
- `node scripts/tenant1-production-scenarios-seed.mjs`
- `node scripts/e2e-engineer-channel-test.mjs`

## Demo Mode

- Start from the CRM header as a management/admin user.
- Demo mode is read-only and uses dedicated demo-tagged records in the real backend.
- The walkthrough now drills into seeded customer, job, quote, and invoice records instead of only list pages.
- Use `npm run crm:demo:bootstrap` to ensure the demo dataset and demo auth-linked profiles exist.
- Live mode and demo mode keep staff data separate. Engineer assignment dropdowns only show active staff profiles with the `engineer` role in the current mode.

## Docs

- `docs/crm-prd.md`
- `docs/CRM_AGENTIC_AI_TECHNICAL_MANUAL.md`
- `docs/HOW_TO_TEST.md`
- `docs/crm-saas-fergus-launch-prd.md`
- `docs/crm-prod-readiness.md`
- `docs/tenant1-roleplay-guide.md`
- `docs/paid-lp-foundation-task-list.md`
- `docs/reporting-dashboard-spec.md`
- `docs/deployment-pipeline.md`
- `docs/lp-ops.md`
- `docs/lp-qa-checklist.md`
