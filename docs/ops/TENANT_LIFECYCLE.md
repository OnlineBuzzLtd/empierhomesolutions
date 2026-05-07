# Tenant lifecycle runbook (Phase 3.3)

Audience: platform_admins operating on behalf of Customer Journeys.

These actions are gated by `src/modules/crm/lib/platform-admin.ts` and accept
two credentials:

1. A logged-in CRM user whose email is in the `PLATFORM_ADMIN_EMAILS`
   comma-separated allowlist (`ops@customerjourneys.ai,shehzad@…`).
2. A signed service call carrying `X-Platform-Admin-Token: …` that matches
   `PLATFORM_ADMIN_API_TOKEN` (used by reaper jobs and CI).

All lifecycle actions write to `crm.tenant_lifecycle_events` (action, actor,
reason, metadata) for audit.

## Suspend

```bash
curl -X POST "https://crm.customerjourneys.ai/api/crm/admin/tenants/{id}/suspend" \
  -H "X-Platform-Admin-Token: $PLATFORM_ADMIN_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "reason": "payment_failed" }'
```

Effects:

- `crm.tenants.status = 'suspended'`, `suspended_at = now()`.
- Every row in `crm.tenant_memberships` for the tenant is marked
  `active=false`, which blocks CRM sign-in via `getCrmSession`.
- Twilio number release is **not** automated — invoke the Twilio console
  or a dedicated script if you need to reroute the tenant's phone number.
- ICS and platform-api proxy calls remain live; the platform-api side
  should be told to pause via its own admin console if required.

## Resume

```bash
curl -X POST "https://crm.customerjourneys.ai/api/crm/admin/tenants/{id}/resume" \
  -H "X-Platform-Admin-Token: $PLATFORM_ADMIN_API_TOKEN"
```

Flips status back to `active`, clears `suspended_at`, reactivates
memberships.

## Export (GDPR Art. 20)

```bash
curl -L "https://crm.customerjourneys.ai/api/crm/admin/tenants/{id}/export" \
  -H "X-Platform-Admin-Token: $PLATFORM_ADMIN_API_TOKEN" \
  -o tenant-export.ndjson
```

Streams newline-delimited JSON. First line is a manifest; each subsequent
line is `{ "_table": "…", "row": { … } }`. Include `public.bookings` from
the platform-api side by running its dedicated export (see
`customerjourneys-platform-api/docs/EXPORT.md`).

## Soft delete

```bash
curl -X DELETE "https://crm.customerjourneys.ai/api/crm/admin/tenants/{id}" \
  -H "X-Platform-Admin-Token: $PLATFORM_ADMIN_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "reason": "churn" }'
```

Effects:

- `status = 'archived'`, `deleted_at = now()`.
- Memberships deactivated.
- Tenant disappears from login lookups.

## Hard delete (reaper)

Run via scheduler (GCP Cloud Scheduler / cron):

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  node scripts/ops/tenant-hard-delete-reaper.mjs
```

Reaps every tenant where `deleted_at < now() - 30 days`. FK cascades on
`crm.tenants` purge all tenant-scoped rows in a single transaction.

Environment:

- `TENANT_HARD_DELETE_DAYS` — retention window (default `30`).
- `DRY_RUN=1` — log what would be deleted without deleting.

## Required env vars

| Name                         | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `PLATFORM_ADMIN_EMAILS`      | Comma-separated allowlist for human admins             |
| `PLATFORM_ADMIN_API_TOKEN`   | Shared secret for service-to-service lifecycle calls   |
