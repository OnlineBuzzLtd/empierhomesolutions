# CRM Production Readiness

This is the release gate for the internal CRM. If these checks pass, the CRM is in a deployable state. If they do not, do not treat the release as production-ready.

## Automated Gates

Run these from the repo root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Route Smoke

Smoke the deployed or local CRM routes without a user session:

```bash
CRM_BASE_URL=https://your-domain.example.com npm run crm:smoke:routes
```

This verifies:

- `/login` renders correctly
- protected CRM routes redirect anonymous users to login
- protected CRM APIs reject anonymous access

## Live Supabase Role / RLS Smoke

Run a real database-side permission check using temporary management and sales users:

```bash
npm run crm:smoke:remote
```

This verifies:

- management can create settings/catalog records
- sales cannot mutate manager-only settings/catalog tables
- sales can create and update operational customer records
- sales cannot perform manager-only destructive actions

The script creates temporary auth users and CRM records, then removes them automatically.

## Required Environment

`crm:smoke:routes` expects one of:

- `CRM_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`

`crm:smoke:remote` expects these variables to be available either in the shell or `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Manual Release Checks

These still need a human confirmation:

1. Verify the intended internal staff accounts exist in Supabase Auth and have correct CRM roles.
2. Confirm Vercel production environment variables match the active Supabase project.
3. Confirm GitHub production environment approval is enabled for deploys from `main`.
4. Run `crm:smoke:routes` against the production URL after deploy.
5. Run `crm:smoke:remote` against the production Supabase project before or immediately after release.

## Current Scope

This production-readiness gate covers:

- CRM auth and protected route behavior
- schema and migration rollout
- RLS and manager-only controls
- quote, invoice, staff, reports, settings, and attachments surfaces already built in the app

It does not replace business UAT for actual office workflows.
