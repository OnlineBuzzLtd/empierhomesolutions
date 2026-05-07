# Empire Home Solutions — Follow-Up Tickets

**Created**: 2026-05-07
**Source**: surfaced during prod hardening pass (analytics install + Supabase restore + lead-form unblock + multi-tenant audit)
**Owner**: TBA per ticket
**Status legend**: 🔴 not started · 🟡 in progress · 🟢 done · ⚪ blocked

---

## Conventions

- **Severity**: `P0` blocks prod / paid traffic · `P1` important within ~2 weeks · `P2` cleanup / nice-to-have
- **Effort**: `XS` <1h · `S` half day · `M` 1–2 days · `L` 3–5 days · `XL` >1 week
- **Atomic**: each ticket = one shippable PR with its own test plan and rollback path. No ticket depends on another being merged unless explicitly listed under **Depends on**.
- **Modular**: tickets can be picked up in any order within their priority tier unless dependencies say otherwise.
- **Each ticket** must include: problem, scope (file paths), acceptance criteria, test plan, rollback note. PR description should link to the ticket ID.

---

# Epic 1 — Production hygiene (block paid traffic until cleared)

## 🔴 EHS-001 · Replace Turnstile sandbox keys with real Cloudflare keys
**Severity**: P0 · **Effort**: XS · **Depends on**: none

**Problem.** Production currently runs Cloudflare's public sandbox keys (`1x00000000000000000000AA` site / `1x0000000000000000000000000000000AA` secret) — these always pass siteverify, providing **zero bot protection**. Only the existing 4-req/min IP rate limit + `companyWebsite` honeypot field stand between `/api/lead` and bot floods. Exposed in [.env.prod via vercel env pull] right now.

**Scope.**
- Cloudflare dashboard → Turnstile → Add Site (`empire-home-solutions.vercel.app` + any custom domains; mode: Managed; pre-clearance: off).
- `vercel env rm` the sandbox values, `vercel env add` real values for Production + Preview.
- Trigger fresh prod deploy via `vercel deploy --prod`.

**Acceptance criteria.**
- `vercel env pull --environment=production` shows real keys (start `0x4...`) with no trailing `\n`.
- Submitting a lead via curl with a dummy token returns `bot_check_failed` (it should — sandbox always-pass behavior is gone).
- Submitting via the actual website form (real Turnstile widget, real token) succeeds and the lead lands in `crm.customers` + `crm.leads`.

**Test plan.**
1. Open `empire-home-solutions.vercel.app/lp/boiler-repair/uxbridge` in a real browser — confirm Turnstile widget renders.
2. Fill form, submit — confirm 200.
3. `psql` count check: `select count(*) from crm.customers where tenant_id = '<empire>'` increments by 1.
4. Replay the same submission via curl with `turnstileToken: "DUMMY"` — expect 403 `bot_check_failed`.

**Rollback.** Re-add sandbox keys with `printf` (no trailing newline), redeploy. ~2 min.

---

## 🔴 EHS-002 · Set `NEXT_PUBLIC_GTM_ID` and `NEXT_PUBLIC_GA4_ID` in Vercel
**Severity**: P1 · **Effort**: XS · **Depends on**: none

**Problem.** Root layout renders GTM and GA4 `<Script>` tags only when their env vars are set ([src/app/layout.tsx:25-46](../src/app/layout.tsx#L25-L46)). Both are unset in Vercel today, so neither GTM nor GA4 fires on prod — only the standalone Google Ads gtag we wired up. Lost analytics for all sessions since the analytics commit.

**Scope.**
- Get the existing GTM container ID (`GTM-XXXXXXX`) from the marketing team.
- Get the GA4 measurement ID (`G-XXXXXXXXXX`).
- `printf '%s' '<id>' | vercel env add NEXT_PUBLIC_GTM_ID production` and same for `preview`. Repeat for GA4.

**Acceptance criteria.**
- View Source on `/`, `/finance`, `/lp/boiler-repair/uxbridge` shows `<script src="…/gtm.js?id=GTM-…">` and `<script src="…/gtag/js?id=G-…">`.
- GTM Preview Mode reports container loaded on every public route.
- GA4 Realtime report shows the test session.

**Test plan.**
- `curl -s https://empire-home-solutions.vercel.app/ | grep -oE 'GTM-[A-Z0-9]+|G-[A-Z0-9]+'` returns both IDs.
- No CSP violations in DevTools console (CSP already permits `googletagmanager.com` / `google-analytics.com`).

**Rollback.** `vercel env rm` both vars, redeploy. Site keeps working without analytics.

---

## 🟢 EHS-003 · Fix Vercel auto-deploy of `main` → Production
**Severity**: P0 · **Effort**: XS · **Depends on**: none

**Problem.** Pushes to `main` currently land as **Preview** deploys, not Production. Today's hardening required manual `vercel deploy --prod` or `vercel promote` + confirmation prompts to ship every change. This is silent (no error, no warning) and will eventually cause a prod / main drift incident.

**Scope.**
- Vercel project → Settings → **Git** → confirm "Production Branch" is `main` (not `master`, not blank, not a different branch).
- If branch is correct, check **Deployment Protection** / **Ignore Build Step** for any condition that downgrades main pushes to Preview.
- Verify `vercel.json` has no `"git": { "deploymentEnabled": false }` override.

**Acceptance criteria.**
- An empty commit + push to `main` produces a deploy listed as `Production` (not `Preview`) in `vercel ls`.
- Subsequent feature merges deploy automatically without `vercel deploy --prod`.

**Test plan.**
1. `git commit --allow-empty -m "test: vercel auto-deploy"` and push.
2. `vercel ls empire-home-solutions` within 60s — top entry must show `Environment: Production`.
3. After Ready, hit `/` and verify build SHA matches the empty commit (via deploy URL or VERCEL_GIT_COMMIT_SHA in any debug header).

**Rollback.** Revert any `vercel.json` changes; restore previous Production Branch setting from the Settings audit log.

---

# Epic 2 — Data layer hardening

## 🟡 EHS-010 · Audit & fix silent PostgREST error swallowing in CRM data layer
**Severity**: P1 · **Effort**: M · **Depends on**: none

**Problem.** [src/modules/crm/lib/data.ts](../src/modules/crm/lib/data.ts) consistently uses `const { data } = await query; return (data ?? []);` — discarding the `error` field. The bug fixed in commit `deb93df` (PostgREST FK ambiguity on `listLeads`) was invisible for weeks because of this pattern. Same pattern is repeated **30+ times** across the file. Any future PostgREST error (RLS denial, schema drift, embed ambiguity) will silently render an empty UI.

**Scope.**
- `src/modules/crm/lib/data.ts` — every `await query` destructure that drops `error`. ~30 call sites.
- Decide pattern: log to Sentry + return empty (preserves UX), or throw + handle in page (loud).
- Recommended: log via [src/lib/logger or Sentry server SDK](../src/) and add a structured warning banner when a list returns empty due to error vs. genuinely empty (so we don't silently mask).

**Acceptance criteria.**
- Every `.from(...).select(...)` call site in `data.ts` either:
  - destructures `error` and forwards it to `Sentry.captureException` with `{ tag: 'crm.data', fn: '<fnName>' }`, OR
  - delegates to a single helper `runCrmQuery()` that handles logging uniformly.
- Add a regression unit test that mocks a Supabase error response and asserts the function logs and returns `[]`.
- A PostgREST FK ambiguity error — like the one we just fixed — would now show up in Sentry within 5 min of being introduced.

**Test plan.**
1. Force a PostgREST error in dev (e.g., bad embed) — confirm Sentry captures it and UI still degrades to empty list.
2. Run existing test suite to catch regressions.
3. `grep -c "data ?? \[\]" src/modules/crm/lib/data.ts` should drop substantially or zero out depending on chosen pattern.

**Rollback.** Single-file revert. No DB or schema changes.

**Progress note (2026-05-07).** Helper landed at [src/modules/crm/lib/data-runner.ts](../src/modules/crm/lib/data-runner.ts) (`runCrmList` + `runCrmSingle`) routing all errors through Sentry with structured tags. Refactored 7 user-facing list functions: `listLeads`, `listCustomers`, `listSites`, `listSiteContacts`, `listJobs`, `listQuotes`, `listInvoices`, and the 5 queries inside `getDashboardData`. **Remaining**: ~20 internal helpers (`listJobAssigneesByJobIds`, `listJobPhasesByJobIds`, `getCustomerDetail`, `getJobDetail`, `getQuoteDetail`, `getInvoiceDetail`, calendar/reports/staff lookups). Lower-impact (silent failures degrade detail-pages-only, not list pages) but should still be migrated for consistency — track as **EHS-010-followup**.

---

## 🔴 EHS-011 · Add integration test for `/api/lead` end-to-end
**Severity**: P1 · **Effort**: S · **Depends on**: none

**Problem.** The PostgREST FK bug + the previous Turnstile breakage + the `\n` env corruption all reached prod undetected because there is no integration test that exercises the full path: HTTP POST → tenant resolve → customer create → lead create → both pages render the row. Every layer was unit-tested in isolation; the seam between them was not.

**Scope.**
- New test file: `tests/integration/lead-intake-end-to-end.test.ts` (matches existing `tests/integration/public-quote-token.test.ts` pattern).
- Spin up a test Supabase project (or use an existing test schema) with Empire tenant + service catalog seeded.
- POST to `/api/lead` with a valid payload + Turnstile bypass-dev token.
- Assert: `crm.customers` has 1 new row, `crm.leads` has 1 new row, `listLeads()` returns it, `listCustomers()` returns it, `getDashboardData().newLeadCount === 1`.

**Acceptance criteria.**
- Test runs in CI on every PR.
- Test fails if any of the four assertions break (customer write, lead write, list query, dashboard count).
- Documented in [docs/HOW_TO_TEST.md](HOW_TO_TEST.md).

**Test plan.** Locally `npm run test:integration -- lead-intake-end-to-end`, plus PR CI run.

**Rollback.** Test file removal; no prod impact.

---

## 🔴 EHS-012 · Verify Sentry server-side capture is wired for lead intake errors
**Severity**: P1 · **Effort**: XS · **Depends on**: EHS-010 (uses the same logger)

**Problem.** Repo has Sentry instrumentation per `c0494ab` and the `instrumentation.ts` files. Unclear whether `/api/lead` errors actually surface in Sentry — none of the recent silent failures (FK ambiguity, env `\n`, Turnstile misconfiguration) appeared there. May be misconfigured or sampled out.

**Scope.**
- Inject a deliberate exception into `/api/lead` in a preview deploy, confirm Sentry shows it.
- Inspect `instrumentation.ts` and `sentry.server.config.ts` for `tracesSampleRate`, `enabled`, `dsn` env wiring.
- Confirm `SENTRY_DSN` (or equivalent) is set in Vercel prod env.

**Acceptance criteria.**
- A handled-but-noteworthy error in `/api/lead` (e.g., `submitLeadToCrm` returns `{ ok: false, code: 'customer_create_failed' }`) emits a Sentry event with structured tags `{ route: '/api/lead', tenant: '<slug>' }`.
- DSN, environment, and release are all populated correctly.

**Rollback.** Revert any sample-rate / DSN changes.

---

# Epic 3 — Multi-tenant landing-page enablement

> **Goal**: every tenant can have their own LP form that writes leads into their own tenant in the shared CRM.
> **Non-goal** (this epic): per-tenant pricing, custom LP design tooling, white-label CRM frontend (those are bigger).

## 🟢 EHS-MT-001 · Host-based tenant resolution in `/api/lead`
**Severity**: P1 · **Effort**: S · **Depends on**: none (DB + middleware infra is already in place)

**Problem.** [src/modules/forms/api/landing-tenant.ts:3](../src/modules/forms/api/landing-tenant.ts#L3) hardcodes `LANDING_PAGE_TENANT_SLUG = "empire-home-solutions"`. Every lead, regardless of host, writes to Empire. Webchat already does host-based resolution ([src/app/api/public/webchat/sessions/route.ts:100](../src/app/api/public/webchat/sessions/route.ts#L100)) — replicate that pattern for the lead form.

**Scope.**
- `src/app/api/lead/route.ts` — read host header, resolve via `tenantSlugFromHostHeader()` ([src/lib/tenant-host.ts:101](../src/lib/tenant-host.ts#L101)), fall back to Empire slug if `slug === null` (apex marketing host).
- `src/modules/forms/api/submitLead.ts` — accept `tenantId` parameter; remove the inline `resolveLandingPageTenantId(admin)` call and require it from the caller.
- New helper: `tenantIdFromSlug(admin, slug)` in `landing-tenant.ts` (single Supabase lookup with caching).

**Acceptance criteria.**
- POST to `/api/lead` from `acme.crm.customerjourneys.ai` writes to tenant `acme` (RLS verified — Empire admins cannot see the row).
- POST from `empire-home-solutions.vercel.app` continues to write to Empire.
- POST from an unknown subdomain returns 400 `tenant_not_found` (don't silently fall through to Empire).
- Service / job_type lookups inside `submitLeadToCrm` already filter by `tenant_id` — confirmed working, no change needed.

**Test plan.**
- Integration test (extends EHS-011): submit to two different host headers, verify two different `tenant_id` rows.
- Manual: cross-tenant submission attempt, confirm RLS isolation.

**Rollback.** Single-file revert; lead form falls back to Empire only.

---

## 🔴 EHS-MT-002 · DB-driven LP branding (logo, business name, phone, copy)
**Severity**: P1 · **Effort**: M · **Depends on**: EHS-MT-001

**Problem.** LP layout hardcodes Empire branding: business name, logo path (`/brands/ehs-logo-white.png`), call number, navigation links, footer copy. See [src/app/(lp)/layout.tsx](../src/app/(lp)/layout.tsx) and [src/lib/business.ts](../src/lib/business.ts). For multi-tenant LPs, this needs to come from `crm.tenant_branding` keyed by the request's tenant slug.

**Scope.**
- Use the `x-tenant-slug` request header (already stamped by middleware) to look up `crm.tenant_branding` server-side in the LP layout.
- Replace `import { businessDetails } from "@/lib/business"` with `await getTenantBranding(slug)`.
- Add columns to `crm.tenant_branding` if missing: `logo_url`, `display_name`, `primary_phone_display`, `primary_phone_raw`, `nav_links jsonb`, `footer_copy text`.
- Preserve Empire's current behavior on `empire-home-solutions.vercel.app` (apex host → falls back to Empire branding row).

**Acceptance criteria.**
- Setting a tenant's `display_name='Acme Heating'` in DB causes the LP header to render "Acme Heating" within one request (no rebuild).
- Empire LP unchanged byte-for-byte when no other tenant exists.
- All existing E2E tests still pass.

**Test plan.**
- Create a second tenant in DB with distinct branding row.
- Visit its host (`acme.crm.customerjourneys.ai/lp/boiler-repair/uxbridge`).
- Confirm header / phone / logo all reflect Acme, not Empire.

**Rollback.** Revert layout file; tenant_branding table can stay (additive).

---

## 🔴 EHS-MT-003 · Per-tenant lead-origin allowlist
**Severity**: P1 · **Effort**: S · **Depends on**: EHS-MT-001

**Problem.** [src/lib/origin.ts](../src/lib/origin.ts) (referenced by `validateRequestOrigin`) reads a single global env var `LEAD_ORIGIN_ALLOWLIST`. Multi-tenant deployment needs per-tenant allowed origins so Acme can only POST from Acme's domain.

**Scope.**
- Add column `crm.tenants.lead_origin_allowlist text[]` (or jsonb).
- `validateRequestOrigin` becomes tenant-aware: pulls the row for the request's tenant and checks against `lead_origin_allowlist`.
- Falls back to global env var if the tenant column is null (preserves Empire behavior during migration).

**Acceptance criteria.**
- Tenant `acme` with allowlist `["https://acme.com"]` accepts POSTs from acme.com and rejects from empire-home-solutions.vercel.app.
- Empire continues to accept its current set.

**Test plan.** Integration test submitting from disallowed origin → 403 `invalid_origin`.

**Rollback.** Default the new column to null; global env var continues to work.

---

## 🔴 EHS-MT-004 · Per-tenant GTM / GA4 / Google Ads loading
**Severity**: P2 · **Effort**: M · **Depends on**: EHS-MT-001

**Problem.** Root layout reads a single set of analytics IDs from env vars. Each tenant needs their own GTM container, GA4 stream, and Google Ads conversion ID — otherwise Acme's leads go into Empire's dashboards.

**Scope.**
- Move analytics IDs from env vars into `crm.tenant_branding` (`gtm_id`, `ga4_id`, `google_ads_id`).
- Root layout becomes async, looks up the tenant branding row, renders Script tags conditional on per-tenant IDs.
- Keep env vars as fallback for the apex marketing site.

**Acceptance criteria.**
- Acme tenant with its own GTM ID set in DB renders Acme's GTM, not Empire's.
- Switching a tenant's GTM ID in DB takes effect on next request (no redeploy).

**Test plan.** View Source on two tenant hosts, confirm distinct `?id=GTM-…` values.

**Rollback.** Revert to env-var-only; tenants share single GTM (acceptable short-term).

---

## 🔴 EHS-MT-005 · Cloudflare Turnstile multi-hostname registration
**Severity**: P2 · **Effort**: XS · **Depends on**: EHS-001 (real keys must exist), EHS-MT-001

**Problem.** When tenants come on with custom domains, the existing Turnstile widget needs each domain added to its allowed-hostnames list, or siteverify will reject tokens from those origins.

**Scope.**
- Document in [docs/lp-ops.md](lp-ops.md): tenant onboarding step "add `<tenant-domain>` to Cloudflare Turnstile widget hostnames".
- Optional: per-tenant Turnstile keys stored in `crm.tenant_branding` for tenants that demand their own Cloudflare account. Default: shared widget with multi-hostname.

**Acceptance criteria.**
- Onboarding doc has a clear "add domain to Turnstile" step.
- Test from a newly-added domain succeeds.

**Test plan.** Add a test domain, submit, verify token accepted.

**Rollback.** N/A (config-only).

---

## 🔴 EHS-MT-006 · Tenant onboarding flow: domain / subdomain provisioning
**Severity**: P2 · **Effort**: L · **Depends on**: EHS-MT-001..005

**Problem.** No documented or automated path for "tenant signs up → gets working LP". Today onboarding is a manual mix of: create tenant row, set branding, add Vercel domain, configure DNS, add Turnstile hostname, set analytics IDs.

**Scope.**
- Decision: **subdomain** (`<slug>.crm.customerjourneys.ai`) is the default, **custom domain** is opt-in for higher tiers.
- Subdomain path: zero DNS work for tenant — wildcard cert covers it. Need automated branding row + analytics defaults.
- Custom domain path: tenant adds CNAME → admin runs `vercel domains add <domain>` via CLI script + adds to Turnstile + adds to `lead_origin_allowlist`. Possibly automate via `scripts/onboard-tenant.mjs`.
- Admin UI: extend [src/app/(crm)/admin/...] tenant creation flow to accept custom domain + auto-stamp branding placeholders.

**Acceptance criteria.**
- A new tenant can be created and have a working LP at `<slug>.crm.customerjourneys.ai/lp/boiler-repair/uxbridge` within 5 minutes of admin actions.
- Custom-domain onboarding documented step-by-step in [docs/ADMIN_MANUAL.md](ADMIN_MANUAL.md).

**Test plan.** Walk through onboarding for a new test tenant from scratch; time it; confirm leads land in correct tenant.

**Rollback.** Onboarding doc-only; no destructive changes.

---

# Epic 4 — Documentation & runbooks

## 🟢 EHS-020 · Runbook: env var management without `\n` corruption
**Severity**: P2 · **Effort**: XS · **Depends on**: none

**Problem.** Three env vars (`NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) were silently corrupted with trailing `\n` because `echo "value" | vercel env add` adds a newline. This took an hour to debug.

**Scope.**
- Add a section to [docs/deployment-pipeline.md](deployment-pipeline.md): "Setting Vercel env vars from CLI — always use `printf '%s' '<value>'`, never `echo`."
- Optional: add a CI lint step that pulls prod env and fails if any value contains `\n`, `\r`, or trailing whitespace.

**Acceptance criteria.** Runbook section exists; CI lint catches a deliberately-corrupted env var in test.

**Test plan.** Add a corrupted env in a preview, run CI, expect failure.

**Rollback.** Doc-only.

---

## 🟢 EHS-021 · Runbook: Supabase project pause / restore
**Severity**: P2 · **Effort**: XS · **Depends on**: none

**Problem.** Today's incident — Supabase project DNS returning NXDOMAIN due to outstanding invoice → org-level pause → individual project pause — was diagnosed live and ate ~30 min. No runbook for "Supabase down, what's the diagnostic ladder."

**Scope.**
- Add to [docs/ops/](ops/) (create if missing): `supabase-project-paused.md` runbook.
- Cover: diagnostic order (DNS → org banner → project status), decision tree (pay invoice vs. project deleted vs. just paused), restore steps, post-restore service-readiness order (Postgres → Storage → Auth, with auth taking longest).

**Acceptance criteria.** Runbook exists; future on-call can resolve the same incident in <5 min.

**Test plan.** Hand the runbook to a teammate, ask them to walk through it for a hypothetical paused project.

**Rollback.** Doc-only.

---

# Quick-look priority queue

| ID | Severity | Effort | Title |
|---|---|---|---|
| EHS-001 | P0 | XS | Replace Turnstile sandbox keys |
| EHS-003 | P0 | XS | Fix Vercel auto-deploy main → Production |
| EHS-002 | P1 | XS | Set GTM + GA4 env vars |
| EHS-010 | P1 | M | Audit silent PostgREST error swallowing |
| EHS-011 | P1 | S | `/api/lead` integration test |
| EHS-012 | P1 | XS | Verify Sentry capture for lead intake |
| EHS-MT-001 | P1 | S | Host-based tenant resolution in `/api/lead` |
| EHS-MT-002 | P1 | M | DB-driven LP branding |
| EHS-MT-003 | P1 | S | Per-tenant lead-origin allowlist |
| EHS-MT-004 | P2 | M | Per-tenant GTM/GA4/Ads |
| EHS-MT-005 | P2 | XS | Turnstile multi-hostname registration |
| EHS-MT-006 | P2 | L | Tenant onboarding flow |
| EHS-020 | P2 | XS | Runbook: env var management |
| EHS-021 | P2 | XS | Runbook: Supabase pause/restore |

**Total estimated effort**: ~10–14 engineer-days for everything; ~2–3 days to clear all P0/P1.

**Suggested sprint order**:
- **Sprint 1 (this week)**: EHS-001, EHS-002, EHS-003 — clears prod hygiene blockers.
- **Sprint 2**: EHS-010, EHS-011, EHS-012 — closes the silent-failure class of bugs.
- **Sprint 3**: EHS-MT-001, EHS-MT-002, EHS-MT-003 — unlocks first non-Empire tenant.
- **Sprint 4**: EHS-MT-004, EHS-MT-005, EHS-MT-006 — multi-tenant hardening + onboarding.
- **Sprint 5 (any time)**: EHS-020, EHS-021 — runbook cleanup.

---

## Cross-cutting non-goals (call out explicitly so they don't sneak in)

- **Per-tenant LP design tooling** (drag-drop, custom CSS) — not in this batch. Tenants get the Empire LP template + DB-driven branding.
- **White-label CRM** (custom logos / colors inside `/dashboard`) — separate epic.
- **Per-tenant pricing / Stripe** — separate epic.
- **Customer self-service domain onboarding** — manual admin task in EHS-MT-006; automated flow is a future epic.
