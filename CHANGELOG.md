# Changelog

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
