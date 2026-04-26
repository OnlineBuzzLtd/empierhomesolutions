# Empire CRM production deploy runbook

This document is the single source of truth for how `empire-home-solutions`
reaches production.

## 1. Vercel project layout

- **Project**: `customerjourneys-crm` (renamed from `empire-home-solutions` in
  Phase 1.7). If you are the first to run this, rename it in Vercel Dashboard
  → Project settings → General → Rename.
- **Primary domain**: `crm.customerjourneys.ai` — Empire Home Solutions is the
  first tenant to live on this apex; per-tenant subdomains come online in
  Phase 3.1 (`*.crm.customerjourneys.ai`).
- **Legacy domain**: keep `empire-home-solutions.vercel.app` pointing at the
  same project for 90 days to catch any stragglers.

### Binding `crm.customerjourneys.ai`

1. Vercel → Project → Settings → Domains → **Add** `crm.customerjourneys.ai`.
2. At the registrar for `customerjourneys.ai`, add:
   - `CNAME crm → cname.vercel-dns.com.` (or the A/AAAA record Vercel
     prescribes if you cannot CNAME).
3. Wait for the HTTPS cert to provision; Vercel handles this.
4. Set `crm.customerjourneys.ai` as the **Primary Production Domain**.

### Wildcard (Phase 3.1)

Once Phase 3.1 is ready:

1. Add `*.crm.customerjourneys.ai` to the same Vercel project.
2. At the registrar add `CNAME *.crm → cname.vercel-dns.com.`.
3. Vercel issues a wildcard certificate automatically.
4. `middleware.ts` already contains the host → tenant slug resolver (added in
   Phase 3.1).

## 2. Deployment Protection

- **Main production deployments** (`main` branch, `crm.customerjourneys.ai`):
  **public** (these are end-user facing).
- **All other deployments** (preview, branch previews, tag previews): **require
  SSO** — Vercel → Settings → Deployment Protection → Preview Protection →
  "Vercel Authentication" (team SSO only).
- **Auto-generated URLs** (`empire-home-solutions-*.vercel.app`): enable
  "Block Vercel-generated URLs" once the custom domain is live.

## 3. Production env vars

All secrets **MUST** live in Vercel (Production target only), not in the git
repository.

### Required

| Name                                     | Purpose                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                   | `https://crm.customerjourneys.ai`                                                         |
| `NEXT_PUBLIC_APP_ENV`                    | `production`                                                                              |
| `NEXT_PUBLIC_SUPABASE_URL`               | Empire Supabase project URL                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`          | Empire Supabase anon key                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`              | Empire Supabase service role key (rotate quarterly)                                       |
| `FORM_WEBHOOK_URL`                       | HubSpot/Zapier fallback                                                                   |
| `CONVERSION_API_SECRET`                  | HMAC shared with internal conversion endpoint                                             |
| `SIGNUP_INVITE_CODE`                     | Invite token when `SIGNUP_MODE=invite`                                                    |
| `SIGNUP_MODE`                            | `invite` (default) or `public`                                                            |
| `LEAD_ORIGIN_ALLOWLIST`                  | Comma-separated origins allowed to POST `/api/lead`                                       |
| `UPSTASH_REDIS_REST_URL`                 | Upstash Redis endpoint (rate limiter)                                                     |
| `UPSTASH_REDIS_REST_TOKEN`               | Upstash Redis token                                                                       |
| `TURNSTILE_SECRET_KEY`                   | Cloudflare Turnstile server secret                                                        |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`         | Cloudflare Turnstile site key                                                             |
| `PLATFORM_WEBHOOK_SECRET`                | HMAC shared with customerjourneys-platform-api outbox                                     |
| `PLATFORM_API_BASE_URL`                  | `https://api.customerjourneys.ai`                                                         |
| `VERCEL_API_TOKEN`                       | Vercel access token (signup wizard attaches tenant domains)                               |
| `VERCEL_PROJECT_ID`                      | Project ID for `customerjourneys-crm`                                                     |
| `VERCEL_TEAM_ID`                         | Vercel team ID (if project is team-owned)                                                 |
| `CRM_TENANT_ROOT_DOMAIN`                 | `crm.customerjourneys.ai` (wildcard root for tenant hosts)                                |
| `PLATFORM_ADMIN_EMAILS`                  | Comma-separated allowlist for platform_admin API access                                   |
| `PLATFORM_ADMIN_API_TOKEN`               | Bearer token for service-to-service tenant lifecycle calls                                |
| `CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL` | Base URL for the CustomerJourneys internal control plane                                  |
| `CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL_OVERRIDE` | Optional process-wide override for local/staging cutovers; wins over tenant link base URLs |
| `CUSTOMERJOURNEYS_INTERNAL_API_TOKEN`    | Internal-service token for runtime diagnostics, native calendar admin, and onboarding     |
| `RESEND_API_KEY`                         | Transactional email provider (Phase 3.4). Alternatively `POSTMARK_API_KEY`.               |
| `CRM_TRANSACTIONAL_FROM_ADDRESS`         | Reply-to / from address (default `noreply@customerjourneys.ai`)                           |

### Strongly-recommended

| Name                        | Purpose                          |
| --------------------------- | -------------------------------- |
| `SENTRY_DSN`                | Server-side Sentry DSN (Phase 4) |
| `NEXT_PUBLIC_SENTRY_DSN`    | Browser Sentry DSN (Phase 4)     |
| `SENTRY_AUTH_TOKEN`         | Source-map upload (Phase 4)      |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional override, default `0.1` |
| `RESEND_API_KEY`            | Transactional email (Phase 3.4)  |

### Calendar access note

- A tenant can have a valid `customerjourneys_runtime_links` row and still fail
  to load `/calendar/availability` or `/calendar/schedule` if
  `CUSTOMERJOURNEYS_INTERNAL_API_TOKEN` is missing in the environment.
- Those pages now use the platform internal-service control plane for calendar
  reads and writes. CustomerJourneys remains the authoritative source for
  working hours, time-off, holidays, ICS subscriptions, and canonical booking
  availability.

### Never set

- `DEV_TEST_UI_ENABLED` — must be unset or `0` in prod. The `/test` page
  hard-refuses to render when `NEXT_PUBLIC_APP_ENV=production` regardless.
- `DEV_TEST_BYPASS_AUTH` — same; `src/modules/crm/lib/dev-auth.ts` ignores it
  in production.
- `FORM_WEBHOOK_URL` pointing at `http://localhost:*`.

## 4. Secret rotation schedule

- **Quarterly (or on suspicion of leak):** `SUPABASE_SERVICE_ROLE_KEY`,
  `PLATFORM_WEBHOOK_SECRET`, `CONVERSION_API_SECRET`, Twilio tokens, ElevenLabs
  keys.
- **On every Phase 1.7 deploy:** run

  ```bash
  VERCEL_TOKEN=… VERCEL_PROJECT_ID=… VERCEL_TEAM_ID=… \
    node scripts/ops/rotate-production-secrets.mjs
  ```

  That rotates `CONVERSION_API_SECRET`, `SIGNUP_INVITE_CODE` and
  `PLATFORM_WEBHOOK_SECRET`, then prints the new values once for mirroring
  into the platform-api side.

## 5. Supabase project hardening

Before cutting over to `crm.customerjourneys.ai`:

1. **Auth → URL configuration** — set **Site URL** to
   `https://crm.customerjourneys.ai` and include the wildcard
   `https://*.crm.customerjourneys.ai` in "Additional redirect URLs".
2. Remove `http://localhost:*` and `https://empire-home-solutions.vercel.app`
   from **Additional redirect URLs** once no one is building against them.
3. **Storage** — confirm `crm-uploads` bucket is **private** (it is; see
   `supabase/migrations/202603120001_crm_foundation.sql:378`).
4. **Database → Replication** — make sure the realtime publication only
   contains tables that the UI actually subscribes to.
5. **Settings → API** — set "Max rows" to 1000 to cap accidental scans.

## 6. Pre-flight checklist

Before merging the Phase 1 release candidate to `main`:

- [ ] `npm audit --omit=dev` reports 0 vulnerabilities.
- [ ] `npm run typecheck` passes (ignore pre-existing test-only TS2304
      errors in `tests/integration/booking-journey.test.ts`).
- [ ] `npm run lint` passes with zero new errors.
- [ ] `npm run build` succeeds.
- [ ] `SIGNUP_MODE=invite` and `SIGNUP_INVITE_CODE` are both set in Vercel
      production.
- [ ] `UPSTASH_REDIS_REST_*` secrets are live and reachable (hit the lead
      form in a preview deploy, confirm 429 after 5 hits).
- [ ] `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set
      from the same Cloudflare Turnstile site.
- [ ] `crm.customerjourneys.ai` resolves and serves with HSTS + CSP headers
      (verify via `curl -sI https://crm.customerjourneys.ai/ | grep -i
    'strict-transport-security\|content-security-policy'`).
- [ ] Deployment Protection is **on** for previews, **off** for production.
