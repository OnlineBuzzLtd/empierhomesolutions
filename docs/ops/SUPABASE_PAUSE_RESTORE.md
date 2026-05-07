# Supabase Project Pause / Restore Runbook

**Audience**: on-call engineer dealing with "the site can't reach Supabase".
**Origin**: EHS-021. Codifies the 2026-05-07 incident where the Empire Supabase project was paused due to an outstanding invoice, surfaced as `NXDOMAIN` on the project hostname.

## TL;DR diagnostic ladder

Run these in order — stop at the first one that fails:

```bash
# 1. Does DNS resolve at all?
dig +short <ref>.supabase.co
# If NXDOMAIN → project is deleted OR the entire org has billing-pause delisting
# If returns IPs → DNS fine, move to step 2

# 2. Does the API respond?
curl -sI https://<ref>.supabase.co/auth/v1/health -H "apikey: <anon-key>"
# 401 / 200 → service is alive, your problem is auth/RLS, not the project
# 521 → Cloudflare can't reach origin; project is starting up (~1–2 min during restore)
# Connection refused → project is paused/stopped

# 3. Is the project actually paused?
# Check https://supabase.com/dashboard/org/<org-id>
# Look for: red "Outstanding invoices" banner; project cards showing "Project is paused"
```

## Decision tree

```
DNS NXDOMAIN
├── Org dashboard shows "Outstanding invoices" banner
│   └── Pay invoice → wait ~5 min → confirm banner cleared
│       └── Click each project's "Restore" button (paying does NOT auto-restore)
│           └── DNS comes back ~30–60s after restore click
│
├── Project not in dashboard at all
│   └── Project was deleted (free tier auto-deletes after long pause)
│       └── Restore from PITR backup (paid tier) OR create new project + replay migrations
│
└── Project in dashboard, status "Active", no banner, but DNS NXDOMAIN
    └── Cloudflare DNS propagation lag — give it 2 min, then escalate to Supabase support

DNS resolves, API returns 521
└── Project is mid-startup (post-restore)
    └── Wait. Services come up in waves: Postgres (~30s) → Storage (~1m) → Auth (~2–3m)
    └── Run: `until [ "$(curl -s -o /dev/null -w '%{http_code}' \
            -H "apikey: $ANON" '<url>/auth/v1/settings')" = "200" ]; do sleep 10; done`

DNS resolves, API returns 401 on health endpoint
└── Project is fully up. The "401 on /auth/v1/settings without apikey" is healthy.
    Try with the anon key — should be 200.
```

## Pre-flight env confirmation

Before assuming Supabase is the problem, confirm what env vars Vercel sees:

```bash
vercel env pull /tmp/.env.check --environment=production
grep -E "SUPABASE_URL|SERVICE_ROLE_KEY|PUBLISHABLE_KEY" /tmp/.env.check | \
  sed -E 's/(=)(.{30}).*/\1\2.../'
```

Make sure:
- `NEXT_PUBLIC_SUPABASE_URL` matches the project ref shown in the Supabase dashboard
- Keys don't have trailing `\n` (see [ENV_VAR_MANAGEMENT.md](ENV_VAR_MANAGEMENT.md))

## Why pause happens (free tier)

Free-tier Supabase projects pause after **~7 days** of inactivity. Paying tier does not pause for inactivity but **will** pause for billing failures (overdue invoice → org-level lock → all projects pause → DNS delisted).

Mitigations:
- Set up auto-pay on a card that won't expire mid-quarter
- For critical tenants, move to a paid tier even if traffic is low — the auto-pause is what bites
- Configure billing email alerts in Supabase dashboard

## Restoring step by step

1. **Pay any outstanding invoice** at supabase.com/dashboard/org/<org-id>/billing — wait until banner clears (~5 min).
2. **Open the project** card and click **Restore project**.
3. **Wait for Postgres** to be reachable (run dig + curl loop above).
4. **Wait for Auth** — typically the slowest service to come back. Watch `/auth/v1/settings` to return 200.
5. **Smoke test the app**:
   ```bash
   curl -sS -X POST "https://empire-home-solutions.vercel.app/api/lead" \
     -H "Content-Type: application/json" \
     -H "Origin: https://empire-home-solutions.vercel.app" \
     -d '{"name":"Smoke Test", ... }'
   # Expect: {"ok":true} HTTP 200
   ```
6. **Verify CRM ingestion** by querying directly:
   ```bash
   PGPASSWORD='...' /usr/local/opt/libpq/bin/psql \
     -h db.<ref>.supabase.co -U postgres -d postgres -c \
     "select count(*) from crm.customers where tenant_id = '<empire-id>';"
   ```

## What stays intact across pause

- All data (rows, schemas, migrations)
- All env keys (anon key, service role key, JWT secret)
- All RLS policies
- All connections strings

So existing apps reconnect cleanly without any code or env changes once the project is restored.

## What does NOT survive pause

- Active websocket / realtime subscriptions (they need to reconnect)
- Any in-flight requests at the moment of pause (return 5xx)
- Compute usage history (resets to 0 on the new billing cycle)
