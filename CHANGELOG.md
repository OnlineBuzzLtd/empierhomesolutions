# Changelog

## 2026-05-07

### Added

- Site-wide Google Tag Manager + Google Analytics 4 loading: GTM/GA4 `<Script>` blocks moved from `src/app/(lp)/layout.tsx` into the root `src/app/layout.tsx` so every public route fires (not just `/lp/*`)
- `NEXT_PUBLIC_GOOGLE_ADS_ID` env var + direct `gtag.js` install for Google Ads (`AW-18033964938` for Empire Home Solutions). Lives alongside GTM so conversion-tag detection works regardless of GTM publish state
- `src/modules/tracking/analyticsScripts.ts` — shared helpers `buildGtmInline` / `buildGa4Inline` / `buildGoogleAdsInline` used by the root layout

### Changed

- `src/app/layout.tsx` — converted to async server component; reads CSP nonce via `headers()` and renders GTM, GA4, and Google Ads loaders gated on their respective env vars
- `src/app/(lp)/layout.tsx` — removed the now-duplicated GTM/GA4 Script blocks (and the unused `headers` / `Script` / `publicEnv` imports). Prevents double-firing on `/lp/*` routes
- `src/lib/security-headers.ts` — extended CSP `connect-src` (`www.google.com`, `googleads.g.doubleclick.net`, `stats.g.doubleclick.net`) and `frame-src` (`td.doubleclick.net`, `bid.g.doubleclick.net`) to permit Google Ads conversion + remarketing endpoints
- `src/lib/env.ts` — added `NEXT_PUBLIC_GOOGLE_ADS_ID` to public env schema, exposed as `publicEnv.googleAdsId`

## 2026-04-16

### Added

- Commusoft-style engineer field app UI as an alternative view for engineers, accessible from `/dashboard` when `engineer_ui` cookie is set to `commusoft`
- `src/modules/crm/components/commusoft/CommsoftHome.tsx` — engineer home screen with greeting, current event card, and bottom navigation
- `src/modules/crm/components/commusoft/CommsoftDiary.tsx` — horizontal date strip with daily job list
- `src/modules/crm/components/commusoft/CommsoftJobEvent.tsx` — workflow-driven job detail with Arrive / No Access / Abort / Leave actions
- `src/modules/crm/components/commusoft/CommsoftJobActions.tsx` — client-side action handler for job status transitions
- `src/modules/crm/components/commusoft/LeaveQuestionsModal.tsx` — full-screen pre-completion questionnaire driven by mandatory checklists
- `src/modules/crm/components/commusoft/ViewToggle.tsx` — radio-style UI mode switcher (Field App / Classic View)
- `src/app/(crm)/diary/page.tsx` — dedicated engineer diary route
- `src/app/(crm)/preferences/page.tsx` — engineer preferences page for view mode switching
- `src/app/actions/ui-preference.ts` — server action to read/write `engineer_ui` cookie
- `src/modules/crm/components/jobs/EngineerFieldView.tsx` — streamlined classic engineer job detail
- `src/modules/crm/components/jobs/CompleteJobButton.tsx` — structured error display for completion blockers
- `src/modules/crm/components/shared/CollapsibleSectionCard.tsx` — reusable accordion component for mobile UX
- `supabase/migrations/202604160001_engineer_ux_improvements.sql` — adds `started_at` to `crm.jobs` and `is_mandatory` to `crm.job_checklists`
- `supabase/migrations/202604160002_job_status_no_access_aborted.sql` — adds `no_access` and `aborted` values to `crm.job_status` enum
- `supabase/migrations/202604160003_crm_compliance_demo_columns.sql` — adds `is_demo` / `demo_scenario_key` to all compliance tables missing them (`job_hazards`, `job_checklists`, `job_certificates`, `purchase_orders`, `supplier_reconciliation`)
- `supabase/migrations/202604160004_crm_job_report_templates.sql` — adds tenant-scoped job report question templates plus a trigger that auto-inserts active templates into new jobs as mandatory checklists, with backfill for existing live jobs missing mandatory checklists
- `src/app/api/crm/settings/job-report-templates/route.ts` — tenant-scoped CRUD API for job report question templates
- `src/modules/crm/components/settings/JobReportTemplatesForm.tsx` — settings UI to add and remove default job report questions
- `scripts/e2e-engineer-channel-test.mjs` — end-to-end script that fires multi-channel booking events, creates engineer-assigned jobs, and verifies they appear in the engineer diary

### Changed

- `src/app/(crm)/dashboard/page.tsx` — engineers now land on Commusoft home by default; classic view available via preferences
- `src/app/(crm)/jobs/[id]/page.tsx` — engineers see `CommsoftJobEvent` by default; classic `EngineerFieldView` available via preferences
- `src/app/(crm)/layout.tsx` — renders a minimal full-screen wrapper for Commusoft mode, hiding default sidebar, header, and bottom nav
- `src/app/api/crm/jobs/[id]/route.ts` — sets `started_at` on first `in_progress` transition; allows `no_access` and `aborted` to bypass compliance checks; returns structured `blockers` payload on completion failure
- `src/modules/crm/lib/status.tsx` — `no_access` (pink) and `aborted` (red) added to `jobStatusConfig`
- `src/modules/crm/lib/data.ts` — `getJobDetail` customer select now includes `email` to match `JobWithRelations` type
- `src/modules/crm/types.ts` — `Job.started_at` added as optional; `JobWithRelations.customer` includes `email`; `JobChecklist.is_mandatory` added
- `src/modules/crm/components/dashboard/JobStatusActionButton.tsx` — success state with `successLabel` for immediate visual feedback
- `src/app/(crm)/settings/page.tsx` — settings now includes a “Job Report Questions” section for tenant-managed engineer completion questions

### Fixed

- Compliance tables (`job_hazards`, `job_checklists`, `job_certificates`, `purchase_orders`, `supplier_reconciliation`) were missing `is_demo` / `demo_scenario_key` columns so all reads via `filterByMode` silently returned empty arrays — the Leave Questions modal and other compliance features were invisible to the app
- `getJobDetail` customer select was missing `email`, causing a TypeScript type mismatch in `CommsoftJobEvent`

### Verified

- `supabase db push` applied all three new migrations
- Engineer diary shows assigned jobs after programmatic job assignment to live tenant
- Leave questions modal displays mandatory checklists for in-progress jobs

## 2026-04-14

### Fixed

- `src/app/api/crm/quotes/[id]/accept/route.ts` — quote acceptance route now returns a well-formed JSON response and correctly persists the accepted-at timestamp and accepted-by user
- `docs/CRM_AGENTIC_AI_TECHNICAL_MANUAL.md` — updated technical manual sections on voice channel integration, ElevenLabs managed-agent webhook flow, and CRM event sync path for voice bookings

### Added

- Voice channel CRM integration verified: `BookingConfirmed` events from ElevenLabs managed-voice calls are published to the CRM through the same `/api/platform/events` path as webchat, SMS, and WhatsApp; voice bookings now appear in CRM records autonomously
- `src/app/api/crm/ai-hub/live/sessions/[id]/route.ts` — session detail endpoint for live AI-Hub channel sessions
- `src/app/api/crm/ai-hub/live/sessions/[id]/messages/route.ts` — message history endpoint for live sessions
- `scripts/plumbersrus-seed.mjs` — Plumbers R Us seed script for multi-tenant demo data
- `docs/crm-buyer-guide.md` — buyer guide for CRM capabilities

### Verified

- Voice booking end-to-end: ElevenLabs → platform-api `post-call` webhook → `publishCrmConversationLifecycle` → CRM `BookingConfirmed` event → CRM lead/appointment records
- All four channels (webchat, SMS, WhatsApp, voice) confirmed to produce identical CRM outcomes on booking confirmation
- `npm run typecheck` passing

## 2026-04-12

### Added

- Tenant-linked live channel testing under `/ai-hub/live`, including linked runtime readiness, proxied webchat, and CRM-side conversation result surfaces
- Platform event ingestion and command execution support for runtime-driven `ConversationStarted`, `ConversationQualified`, `ConversationRestarted`, `BookingConfirmed`, and escalation flows
- First-class CRM schema support for strict booking capture fields, including customer first/last name, job problem/urgency/affected-area capture, preferred scheduling fields, and notification delivery timestamps/status
- Technical manual coverage for the CRM/runtime integration model in `docs/CRM_AGENTIC_AI_TECHNICAL_MANUAL.md`

### Changed

- Moved the front-desk booking flow onto a strict per-session booking contract so bookings are not confirmed until required service, contact, property, problem, urgency, preferred-date/time, and slot-confirmation fields are captured in the current session
- Linked Empire tenant 1 to the live CustomerJourneys runtime and surfaced runtime readiness, booking results, and operator review state directly inside the CRM
- Updated CRM API validation and form handling so the new strict booking fields are writable through the existing customers, leads, and jobs flows

### Verified

- `npm run typecheck`
- `npx vitest run tests/crm/api-routes.test.ts --reporter=dot`
- live local CRM availability on `http://127.0.0.1:3000/login`
- live runtime-to-CRM event sync through `/api/platform/events`
- confirmed end-to-end webchat booking with CRM materialization for conversation `467de906-7817-467b-86db-0f4c6eb70134`

## 2026-03-29

### Added

- Real non-demo tenant-1 admin/engineer roleplay workflow data so office and field users can work against the same live job, calendar, notes, and attachment records
- Reusable tenant-1 production scenario seed script plus a roleplay guide covering the best live jobs, leads, and user accounts for buyer demos

### Changed

- Disabled demo mode for tenant 1 only and removed tenant-1 demo memberships, demo profiles, demo walkthrough records, and demo auth users so Empire now runs as production-only CRM data
- Replaced the old tenant-1 roleplay/demo dataset with a realistic 14-day production scenario set covering repair, service, install, landlord, plumbing, cylinder, commercial, and quoting workflows
- Hardened website lead intake so tenant-1 landing-page enquiries are tenant-scoped, use stricter customer matching, dedupe repeated submissions inside the intake window, and preserve duplicate-review metadata instead of creating noisy duplicate leads
- Improved lead cards to surface linked customer phone, email, address/postcode, and a direct customer link for office users
- Normalized blank optional select values to `null` across CRM validation so create/update flows no longer fail when fields such as `Unassigned` submit `""` instead of a UUID/date/time value
- Fixed engineer job note and attachment forms so the real page buttons now submit reliably through the client UI and sync immediately back to admin on the same job

### Verified

- `node scripts/tenant1-production-scenarios-seed.mjs`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `supabase db push --linked`
- live website lead submission against `https://empire-home-solutions.vercel.app/api/lead`
- local engineer UI roleplay on seeded tenant-1 job `da2b191a-2d4c-427a-9297-0c66220e78ab`
- live engineer UI roleplay on seeded tenant-1 job `da2b191a-2d4c-427a-9297-0c66220e78ab`

## 2026-03-28

### Added

- Multi-tenant CRM SaaS foundation with `crm.tenants`, `crm.tenant_memberships`, `crm.tenant_settings`, `crm.tenant_branding`, tenant-scoped numbering, tenant-aware storage, and Empire Home Solutions preserved as tenant one
- Public CRM workspace signup at `/signup` plus reusable tenant provisioning logic for onboarding and admin-assisted tenant creation
- Tenant workspace switching and tenant-branded quote/invoice PDF rendering
- Fergus-critical job delivery data model additions for sites, site contacts, job assignees, job phases, and job variations
- Fergus-critical commercial workflow additions for quote versions, quote acceptance, invoice schedules, staged invoice generation, and staged payment tracking
- Fergus-critical compliance and supplier-control workflow additions for hazards, checklists, certificates, purchase orders, and supplier reconciliation
- Live backend feature smoke coverage in `scripts/crm-feature-smoke.mjs`

### Changed

- Reworked CRM auth/session and RLS around tenant membership instead of single-workspace authenticated access
- Removed Empire-specific CRM login copy so the CRM shell can operate as a reusable SaaS product
- Hardened remote smoke and demo bootstrap scripts for tenant-scoped profiles, certifications, and attachments
- Updated local route smoke to cover both `/login` and `/signup`

### Verified

- `supabase db push --linked`
- `npm run crm:smoke:remote`
- `npm run crm:smoke:features`
- `npm run crm:smoke:routes`
- `npm run crm:demo:bootstrap`
- `npm run crm:smoke:demo`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `rm -rf .next && npm run build`

## 2026-03-25

### Changed

- Fixed CRM quote creation so numbering now calls the `crm.next_sequence` RPC correctly instead of falling through to `public`
- Switched job engineer assignment from free text to staff-driven dropdowns using active `engineer` profiles in the current CRM mode
- Normalized blank optional job fields to `null` before validation and persistence so empty selects/date fields no longer fail against UUID/date/time columns
- Fixed CRM settings role saves to upsert `crm.user_profiles` on `user_id`, resolving duplicate-key failures when updating existing users
- Hardened job, quote, and settings mutation routes to return JSON errors instead of uncaught server exceptions on malformed payloads

### Added

- CRM regression tests covering schema-scoped sequence allocation, blank optional job fields, and settings role upsert behavior

### Verified

- `npx vitest run tests/crm/api-routes.test.ts`
- `npx vitest run tests/crm/helpers.test.ts`

## 2026-03-22

### Added

- CRM staff and reporting modules under `src/app/(crm)/staff` and `src/app/(crm)/reports`
- CRM catalog APIs and UI for suppliers, products, and quote templates
- CRM demo mode with seeded demo dataset, guided walkthrough state, live replay cards, and drilldown into demo customer/job/quote/invoice records
- CRM production smoke scripts for routes, roles, env loading, and demo bootstrap/smoke validation
- CRM production readiness documentation in `docs/crm-prod-readiness.md`
- Supabase migrations for staff/reporting/catalog tables, legacy CRM RLS hardening, and demo-mode dataset support

### Changed

- Hardened CRM API access and role checks across mutating routes
- Reworked calendar into a grouped scheduling view with reminders and recurring demoable workflow data
- Improved quote and invoice flows with template support, better line-item editing, and stronger attachment handling
- Added signed attachment access and grouped attachment presentation across CRM detail views
- Stabilized standalone typechecking with `tsconfig.typecheck.json` and a deterministic `npm run typecheck`
- Upgraded the demo walkthrough from static copy to route-aware live playback with typed field population, workflow events, attachments, certifications, and detail-record drilldown
- Replaced the placeholder deploy flow with a real Vercel deployment workflow and post-deploy CRM smoke hooks

### Verified

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run crm:smoke:demo`
- remote Supabase migrations applied to project `dodttkkkmxsqfewuahqi`

## 2026-03-12

### Added

- Supabase-backed CRM foundation under `src/app/(crm)` and `src/modules/crm`
- CRM API routes for leads, customers, jobs, appointments, quotes, invoices, payments, expenses, notes, assets, attachments, and settings
- Supabase migrations for CRM schema, seed data, initial admin promotion, schema/API access, and PostgREST reload
- CRM settings/backend UI for services, job types, custom fields, required documents, and user role updates

### Changed

- Replaced CRM mock-data wiring with live Supabase clients and typed data loaders
- Protected CRM routes and login/session flow
- Updated CRM layouts and login rendering to remove nested `html/body` hydration issues
- Fixed CRM env handling so client-side Supabase setup reads `NEXT_PUBLIC_*` values correctly
- Removed installer logo strip content from public LP/homepage sections where previously requested
- Removed the paid-campaign helper copy from `/areas-we-cover`
- Simplified the LP issue field copy on mobile
- Expanded `docs/crm-prd.md` to reconcile missing business requirements with the Supabase PRD

### Verified

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- remote Supabase migrations applied to project `dodttkkkmxsqfewuahqi`
- authenticated CRM user created and promoted for internal access
