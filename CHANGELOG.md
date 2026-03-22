# Changelog

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
