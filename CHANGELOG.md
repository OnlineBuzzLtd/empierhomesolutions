# Changelog

## 2026-05-18

In-person sales Demo Console reached its first working end-to-end state today. Built the full feature (Streams A→F), shipped a layout fix and the engineer-view sidebar fix, then a series of bug-corrections after first contact with reality.

### Added — Demo Console (full feature)

- **Tenant-scoped `/demo` + fullscreen `/demo/run`** ([src/app/(crm)/demo/](src/app/(crm)/demo/), [src/modules/crm/demo-console/](src/modules/crm/demo-console/)). Manager/admin only, gated by new `crm.tenant_settings.demo_console_enabled` column (seeded `true` for Empire, `false` everywhere else). Sidebar item conditional on the same flag. Settings page gets a "Demo Console" toggle ([/api/crm/settings/demo-console](src/app/api/crm/settings/demo-console/route.ts)) so future customer tenants can self-serve.
- **Prospect-facing tiles** ([WebchatTile](src/modules/crm/demo-console/tiles/WebchatTile.tsx), [VoiceTile](src/modules/crm/demo-console/tiles/VoiceTile.tsx), [MessagingTile](src/modules/crm/demo-console/tiles/MessagingTile.tsx), [InboundLeadTile](src/modules/crm/demo-console/tiles/InboundLeadTile.tsx)). Inline webchat backed by the existing CJ runtime; voice / SMS / WhatsApp tiles display Empire's real Twilio numbers (`+447401248976`); Google + Meta tiles are display-only placeholders, triggered from the operator panel.
- **Operator panel** ([OperatorPanel.tsx](src/modules/crm/demo-console/operator/OperatorPanel.tsx)) opened by `Ctrl+Shift+D`. Sections: PECR consent capture (placeholder legal wording pending lawyer review), Google + Meta lead-replay triggers, end-and-cleanup with two-step confirmation, kill switch.
- **Live CRM pane** ([LiveDemoPane.tsx](src/modules/crm/demo-console/LiveDemoPane.tsx) + [use-demo-session-feed.ts](src/modules/crm/demo-console/use-demo-session-feed.ts)). First Supabase realtime usage in the codebase; subscribes to INSERT events on customers/leads/jobs/appointments filtered to `is_test=true` for the active tenant, scoped to the open demo session.
- **6 new API routes** under `/api/crm/demo/*` — consent, sessions/active, trigger/google, trigger/meta, cleanup, kill, preflight. All gated by [session-guard.ts](src/modules/crm/demo-console/server/session-guard.ts) (tenant + role + active-session checks).
- **Preflight banner** ([PreflightBanner.tsx](src/modules/crm/demo-console/PreflightBanner.tsx)) polls env / Supabase / synthetic-number guard / Twilio status every 60s and renders an expandable strip in the `/demo/run` header.
- **Demo Console module README** ([src/modules/crm/demo-console/README.md](src/modules/crm/demo-console/README.md)) covering the phone-number policy, allowlist convention, Twilio matrix, and a 5-step operator runbook for running a real demo.
- **Migrations** — `202605180001` adds `is_test` to customers/leads/jobs with partial indexes; `202605180002` adds `demo_console_enabled`; `202605180003` adds CRM tables to the `supabase_realtime` publication; `202605180004` adds `crm.demo_sessions` (RLS-scoped) + `demo_kill_switch_at` on tenant_settings. All four applied to prod via `supabase db push --linked`.

### Added — Safety scaffolding

- **Synthetic-number guard at `/api/platform/events`** ([synthetic-number-guard.ts](src/modules/platform/lib/synthetic-number-guard.ts)). Rejects payloads whose phone fields match the May 12 / 14 incident fingerprints (`+447463366` prefix; the historical sender `+447401248976` as destination); Twilio Magic Numbers always pass; `DEMO_CONSOLE_ALLOWLIST` env var overrides. Returns HTTP 422 with `{ code: "synthetic_number_blocked", pattern, field }`. **18 unit tests**, CI-required. Makes a repeat of the May incidents mechanically impossible from this code path.
- **`is_test` propagation through command-executor** ([command-executor.ts](src/modules/platform/lib/command-executor.ts)). Extracted `extractIsTestFromPayload` as the single source of truth; refactored the existing appointment-only path to use it; threaded the flag through customer / lead / job inserts so cleanup can find every demo-created row.
- **CLAUDE.md tightened** ([CLAUDE.md](CLAUDE.md)) — new Correctness rule "No rollouts without tests for the thing being rolled out", citing the `customer_assets.is_test` cleanup-endpoint bug (shipped because nothing tested the table list against the schema) as the rationale. Definition-of-done now says shipping without the corresponding test means the change is **not done**, even if Vercel deployed.

### Added — UK mobile normaliser

- **`normaliseUkMobileToE164` helper** ([normalise-uk-mobile.ts](src/modules/crm/demo-console/normalise-uk-mobile.ts)) + **11 tests**. Operators type natural shapes (`07700 900123`, `0044 7700 900123`, `(+44) 7700-900123`) and the consent form normalises before sending. Empire's `07779305853` from the 2026-05-18 demo screenshot is pinned as a regression case.

### Fixed — production bugs surfaced by first real run

- **Voice / SMS / WhatsApp tiles read from `crm.customerjourneys_runtime_links.display_*_number` directly** ([(crm)/demo/run/page.tsx](src/app/(crm)/demo/run/page.tsx)). The runtime link already has these populated for every onboarded tenant — no cross-service round-trip needed for Empire. Falls back to a new platform-api endpoint, then to `DEMO_*` env vars.
- **`/api/crm/demo/cleanup` no longer references `is_test` on cascade-children of `crm.customers`** ([cleanup/route.ts](src/app/api/crm/demo/cleanup/route.ts)). First-run hit `column customer_assets.is_test does not exist` because the original endpoint listed `customer_assets`, `quotes`, `invoices`, `payments` inline. Those tables cascade from `crm.customers`, so the explicit deletes are redundant *and* would always fail. Extracted [cleanup-tables.ts](src/modules/crm/demo-console/server/cleanup-tables.ts) as the contract, added a **4-test** unit suite asserting the cleanup list matches the `is_test` allowlist and that the migrations adding the column exist on disk.
- **Trigger endpoints look up the real workspace alias** ([trigger/google/route.ts](src/app/api/crm/demo/trigger/google/route.ts), [trigger/meta/route.ts](src/app/api/crm/demo/trigger/meta/route.ts)). Were sending tenant_id where workspace_id was expected; platform-events route 404'd. Fix: resolve `workspace_id` from `crm.workspace_aliases` (Empire = `75d76e43-…`, tenant_id = `11111111-…`). **12 tests** for the envelope builder + HMAC contract.
- **Webchat tile reads `session.conversation.id`** ([WebchatTile.tsx](src/modules/crm/demo-console/tiles/WebchatTile.tsx)) — was reading `session.conversationId` and throwing "Session response missing conversationId" on every send. Extracted [parseWebchatSessionResponse + parseWebchatTurnResponse](src/modules/crm/demo-console/parse-webchat-session.ts) with **17 tests** pinning the canonical CJ runtime shape + two legacy shapes; tile now also surfaces the AI reply (was sending messages without displaying the response).
- **`/demo/run` layout no longer pushes the live CRM pane off-screen** ([WebchatTile.tsx](src/modules/crm/demo-console/tiles/WebchatTile.tsx) + [DemoRunStage.tsx](src/modules/crm/demo-console/DemoRunStage.tsx)). Added `h-full min-h-0` + `md:grid-rows-2` so tiles fill their grid cells and the chat transcript scrolls internally instead of growing the cell.
- **Kill switch state hydrates from server on mount** ([demo/sessions/active/route.ts](src/app/api/crm/demo/sessions/active/route.ts) + [DemoRunStage.tsx](src/modules/crm/demo-console/DemoRunStage.tsx)). Was always `null` on page load; now reads `tenant_settings.demo_kill_switch_at` in parallel with the active-session lookup so the UI matches DB truth on first paint.
- **`/demo` middleware regex includes `/demo`** ([middleware.ts](middleware.ts)). Was missing from `CRM_PROTECTED_PATH_PATTERN`, so `updateCrmSession` never ran for `/demo*` and `x-crm-pathname` was empty — the `isDemoRunMode` chrome-bypass check silently failed and the sidebar covered most of the fullscreen view.
- **Consent form drops "(E.164)" jargon** ([ConsentForm.tsx](src/modules/crm/demo-console/operator/ConsentForm.tsx)). Operators on the laptop in front of a prospect don't speak engineer.
- **Engineer-view sidebar can switch back from Classic to Field App** ([(crm)/layout.tsx](src/app/(crm)/layout.tsx)). Pre-existing bug: the Classic chrome had zero links to `/preferences`, so once an engineer flipped, they were stranded. Added a desktop pill in the header and a 5th mobile bottom-nav item.

### Verified

- 75+ unit tests across the new modules, all green: synthetic-number-guard (18), extract-is-test-from-payload (8), demo-console-cleanup-tables (4), parse-webchat-session (17), substitute-placeholders (10), post-platform-event (12), parse-tenant-numbers (6), normalise-uk-mobile (11). Plus 8 loop-guard tests in the CJ repo.
- Typecheck clean on both repos.
- Cloud Run deployed twice today via the Customer Journeys repo: `b80e629f` (numbers endpoint) and `034f991a` (softer wordings + loop-guard exemption). All three services (platform-api, voice-gateway, workers) live and serving traffic.
- 4 Empire Supabase migrations applied to prod via `supabase db push --linked`.
- Vercel auto-deployed Empire continuously throughout the day (12 deploys).

### Action items deferred — pick up in a fresh focused turn

- **P-2 (orchestrator offer-is-hold)** in the CJ repo. Structural bug behind today's "slot got taken" wording: [text-booking-orchestrator.ts:1882](Customer-Journeys-AI-v1/customerjourneys-site/services/platform-api/src/lib/text-booking-orchestrator.ts#L1882) offers a concrete slot to the customer *before* any availability check; the check at line 1918 only runs *after* the customer says YES. Today's wording change covers up the symptom — the real fix is to restructure so `checkAvailability` runs before the "I can do X. Reply YES" reply. Affects every real customer text/whatsapp/voice booking, deserves careful staging.
- **A-2 (dedicated demo Twilio subaccount)** — operational task. Currently the Demo Console points at Empire's main Twilio sender (52/100 reputation). The "⚠ Live Twilio sender" banner in the `/demo/run` header makes the risk visible to the operator but doesn't fix it.
- **PECR consent text legal review** — placeholder copy in [ConsentForm.tsx](src/modules/crm/demo-console/operator/ConsentForm.tsx). Stored verbatim on every `demo_sessions` row.
- **Replace placeholder Google + Meta webhook fixtures** with real captured payloads. Currently in [demo-console/fixtures/](src/modules/crm/demo-console/fixtures/).

## 2026-05-14

### Fixed

- **Calendar squatter cleanup — platform-api side** ([scripts/cancel-platform-api-squatters.mts](scripts/cancel-platform-api-squatters.mts)). CAL-006 sibling of CAL-002. CAL-002 cleaned Empire's `crm.appointments`, but the platform-api's separate Cloud SQL `bookings` table still held **93 untagged test-persona rows** from runs that pre-dated CAL-003's `is_test=true` tagging. `hasAvailabilityConflict` consulted that table FIRST and reported a conflict on every weekday slot through 2026-06-15, which is why the production agent kept saying "earliest is the 15th of June" after CAL-002. New idempotent ops script: dry-run by default, cancels with `--cancel --confirm-cancel-bookings=I-AM-SURE`, tags rows with `metadata.is_test=true` AND `metadata.cancelled_reason='CAL-006-platform-squatter-cleanup'` (defence in depth + cancellation rollback key). Predicate matched exactly **90 rows**, left 3 real customers (Shaz × 2, Karen × 1) untouched. After cleanup the engineer resource had blockers on only 2 days (the 3 real bookings) instead of every weekday for a month.

### Investigated

- **ElevenLabs managed-voice agent stalled on availability lookups** — a real customer call this morning failed `search_availability` 5 times in a row, then `check_availability` returned "that time has already passed" for 2 PM today. Root cause was in the CustomerJourneys repo (not Empire): `limit` declared as `type: "string"` in the ElevenLabs tool definition vs `z.number()` in the platform-api schema (every call → HTTP 400), and a static `Today's date is Wednesday, 13 May 2026` baked into the agent's system prompt at provision time. Fix landed in CustomerJourneys `601db752` (see that repo's CHANGELOG); no Empire-side code change.
- **40 undelivered Twilio messages (error 30453) traced to a single test run on 2026-05-12** — Twilio Insights showed health score 52/100 (down 40 from prior week), Compliance/Fraud/Sent-rate all flagged Bad. All 40 messages clustered in a 60-second window starting 23:45:13 BST on May 12, all from Empire's production sender `+447401248976` to a band of synthetic `+447559 12XXXX` numbers generated by `scripts/live-empire-channel-tests.mts`. The platform-api side had `MESSAGING_ADAPTER=mock` set (correctly suppressed its own outbound), but the **CRM-side notification path on Vercel** received `BookingConfirmed` events and queued real customer confirmation SMS via Empire's own Twilio integration — which knows nothing about the mock adapter. The mock adapter is half a kill-switch, not all of one.

### Documented

- **CLAUDE.md hardened after second Twilio incident** ([CLAUDE.md](CLAUDE.md), commit `44c4ffb`). New rules: (1) "Tier 1 is NOT zero-Twilio for the full system" — anything that creates a confirmed booking end-to-end is at minimum Tier 3 for authorization. (2) Named ban list of the four scripts that fire Twilio (`live-empire-channel-tests.mts`, `e2e-engineer-channel-test.mjs`, `live-calendar-roundtrip-test.mjs`, `live-lp-tests.mjs`) plus a pattern matcher for new scripts. (3) Per-script fresh authorization — every invocation requires the user to name the script in the current turn; previous approvals do not carry forward. (4) Re-running a failed test is itself a Twilio cost; diagnose from logs and persisted traces instead. (5) Default verification posture is read-only diagnostics + webhook smoke (`curl POST /internal/voice/...`), NOT end-to-end flows.

### Verified

- Predicate dry-run + cancel run + post-cleanup query: 110 → 20 active rows in the next 30 days, untagged real-customer count: 3.
- Production calendar availability search for tomorrow (2026-05-15) returns open slots from 08:00 onwards.

### Action items deferred to operator

- **Enable Twilio "SMS Pumping Protection"** on the messaging settings page. Twilio Insights flagged this exact account; SMS Pumping Protection is the carrier-side ML guard that would have blocked the synthetic-number pattern. Free in US/Canada, paid in UK (per-message fee).
- **Optional**: enable phone-number redaction (privacy/GDPR posture), and HTTP Basic Auth on media (futureproofs MMS).
- **Optional**: separate Twilio sub-account for testing, so the production sender is never the one firing test traffic. Half a day of infra work; would make the next incident impossible at the carrier layer.

## 2026-05-13

### Fixed

- **Agentic front desk reliability** ([scripts/live-empire-channel-tests.mts](scripts/live-empire-channel-tests.mts)). Voice validation now uses the CustomerJourneys managed `search_availability` tool for a broad 60-day window instead of brute-forcing individual slot checks. After `create_booking_hold`, the harness adopts the returned booking's canonical `startTime`, `endTime`, and `resourceId` before confirmation.
- **Tier 1 validation stability** ([docs/agent-reliability-prd.md](docs/agent-reliability-prd.md)). Documented the CustomerJourneys reliability patchset, mock revision `customerjourneys-platform-api-00728-zih`, production revision `customerjourneys-platform-api-00729-zon`, and three consecutive 10/10 Empire live-channel runs.

### Verified

- `PLATFORM_API_URL="https://mock---customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app" npx tsx scripts/live-empire-channel-tests.mts` — 3 consecutive **10/10** runs.
- Production CustomerJourneys platform traffic is now on `customerjourneys-platform-api-00729-zon`; the mock tag remains on `customerjourneys-platform-api-00728-zih`.

## 2026-05-12

### Added

- **Quote-builder package card** ([src/modules/crm/components/forms/PackageRollupCard.tsx](src/modules/crm/components/forms/PackageRollupCard.tsx)). Replaces the previous one-line amber banner for an inserted package with a boxed card carrying image, Show more/less description, Cost / Margin / Price / Qty / Subtotal grid, and optional per-package VAT line. Numbers sum from the package's component rows via the single source of truth `computeLineRollup` — no parallel margin math. Snapshot semantics preserved: financial fields live on the copied component rows, image is looked up live by `package_id` (visual only).
- **Section grouping in the quote line-item editor** ([src/modules/crm/components/forms/LineItemsEditorV2.tsx](src/modules/crm/components/forms/LineItemsEditorV2.tsx)). `section_header` rows now produce bordered visual frames around their items; items before any header land in an implicit "Unnamed Section". Underlying `line_items` array order is unchanged, so `computeQuoteRollup` output is byte-identical.
- **`crm.packages.default_markup_percent` now drives auto-pricing of components from cost** ([src/modules/crm/components/forms/PackageManagerForm.tsx](src/modules/crm/components/forms/PackageManagerForm.tsx)). Previously the markup % was captured but ignored. Now: set markup + cost → price auto-fills at `cost × (1 + markup/100)`. Manual price edits are sticky until cost is re-entered (one-shot reset). Applying a product also re-honours the markup.
- **Per-package VAT toggle** in Workspace Profile settings ([src/app/api/crm/settings/tenant/route.ts](src/app/api/crm/settings/tenant/route.ts), [PackageRollupCard.tsx](src/modules/crm/components/forms/PackageRollupCard.tsx)). Off by default; opt-in via the new `tenant_settings.show_per_package_vat` flag. Quote-level VAT math is untouched — per-package VAT is a derived display of the same money.
- **`/settings/packages` is now linked from the Settings index** ([src/app/(crm)/settings/page.tsx](src/app/(crm)/settings/page.tsx)). The Quote-builder Packages page has existed since April; you previously had to know the URL to reach it.
- **Platform-bridge calendar routes accept CRM `providerReference`** ([src/app/api/platform/calendar/events/[bookingId]/route.ts](src/app/api/platform/calendar/events/[bookingId]/route.ts), [confirm/route.ts](src/app/api/platform/calendar/events/[bookingId]/confirm/route.ts)). Older callers used `bookingId` (`appointments.external_id`); current CalendarAdapter callers pass `providerReference` (`appointments.id`). Routes now accept both, falling back to `id` lookup only when the path segment is UUID-shaped and the `external_id` lookup found nothing. Structured `matchedBy` log lines added for debuggability.
- `docs/quote-package-card-prd.md` — ticketed PRD covering PKG-001 to PKG-006, including the invariants any future change must preserve.
- `supabase/migrations/202605120001_crm_packages_image_url.sql` — adds `packages.image_url text null` (additive, RLS inherited).
- `supabase/migrations/202605120002_crm_tenant_settings_per_package_vat.sql` — adds `tenant_settings.show_per_package_vat boolean default false`.

### Fixed

- **`crm.next_sequence` overload ambiguity broke Create Quote** ([supabase/migrations/202605120003_drop_legacy_next_sequence.sql](supabase/migrations/202605120003_drop_legacy_next_sequence.sql)). The multitenancy migration in March added `crm.next_sequence(text, uuid default current_user_tenant_id())` but never dropped the older `crm.next_sequence(text)`. PostgREST refused to pick between them when called with a single argument, surfacing as a generic "Failed to create quote." Dropped the legacy single-arg form; the two-arg version's default makes the call-site signature identical, so the application caller (`nextCrmSequence` in `src/modules/crm/lib/api.ts`) is unchanged.
- **POST `/api/crm/quotes` was swallowing real Postgres errors** ([src/app/api/crm/quotes/route.ts](src/app/api/crm/quotes/route.ts)). The catch block's `error instanceof Error` check returned false for Supabase `PostgrestError` (a plain object with `.message`), collapsing every failure into a useless generic string. Now pulls `.message` from any throwable shape and `console.error`s the full throwable for Vercel runtime logs.
- **Empty-string `valid_until` rejected by Postgres** ([src/modules/crm/lib/validation.ts](src/modules/crm/lib/validation.ts)). The Create Quote form posts `valid_until=""` when the date field is left blank; Zod accepted the empty string but Postgres rejected it on insert into the `date` column. Coerced to `null` at the validator using the same `emptyStringToNull` preprocessor already used elsewhere in the file.

### Verified

- Production deploy of all package work to `empire-home-solutions.vercel.app`. Migrations applied to the linked Supabase project.
- `npm run typecheck` clean; unit tests 57/57 green; `next build` no errors.
- Create Quote end-to-end working: template-seeded quote drafts now insert successfully with both blank and populated `valid_until` dates.

## 2026-05-09

### Fixed

- **CRM bridge — accept snake_case identity keys + structured address from CJ `BookingConfirmed`** (`src/modules/platform/lib/command-executor.ts`). CJ ships identity as `customer_full_name` / `customer_phone` / `customer_email` / `customer_postcode` / `service_address_line1` / `service_city`; Empire previously read only the camelCase / `service*` variants (`customerName`, `customerPhone`, etc.). Zero overlap meant every voice-booked customer slipped past `findCustomerByIdentity` — Lead and Appointment rows landed but `customer_id` stayed NULL. Lookups in `createCustomerFromPayload`, `updateCustomerFromPayload`, and `resolveCustomerForPayload` now accept both naming conventions; legacy form-intake / `PlatformBookingPayload` paths keep working.
- **CRM bridge — attach lead to customer after the BookingConfirmed self-heal** (`command-executor.ts`, `CreateOrUpdateAppointment`). The earlier `attachLeadToCustomer` call ran BEFORE the self-heal that resolves the customer, so on a fresh BookingConfirmed-only flow `crm.appointments.customer_id` landed correctly but `crm.leads.customer_id` stayed NULL — the `/leads` view showed every voice booking with an empty Customer column. Mirrored the appointment self-heal for the lead so a single pass populates both linkages.
- **Customer merge — latest non-empty payload value wins** (`command-executor.ts`, `updateCustomerFromPayload`). Previously only patched NULL fields. Real example: a return caller said "Michael Jackson" using a phone already on file as "John Jones"; the booking landed but the customer record kept the stale name because `full_name` wasn't NULL. Replaced `if (!customer.X && nextX)` guards with `if (nextX)`. Empty / null payload values still skip — we never blank out an existing field. Safe across all callers verified (BookingConfirmed updates everything; ConversationStarted carries no name for voice and only the opener-form name for webchat).

### Added

- `scripts/local/follow-agent-to-crm.sh` — local Agent → CRM live tail. Streams Cloud Run platform-api activity (tool calls, `PUBLISH BookingConfirmed`, errors) alongside Supabase polls of `crm.platform_event_log` / `leads` / `customers` / `appointments`. Single colour-coded terminal feed for live-call observability without standing up new infrastructure. Stops with Ctrl+C.

### Verified

- End-to-end live call: `BookingConfirmed accepted` → `LEAD created … status=booked customer=…` → `APPT created … customer=… lead=…` in 4 seconds, with the customer record carrying the agent-stated name on every subsequent call.
- **Cross-channel `ConversationStarted` parity** verified live in production after CJ-side PR #23 landed: webchat / SMS / WhatsApp / voice all now publish on first contact and Empire's `MatchCustomerByChannelIdentity` + `LinkConversationToCustomerOrJob` handlers seed the conversation link record at conversation-open. Idempotency on Empire's `crm.platform_event_log` (`UNIQUE (tenant_id, source_system, idempotency_key)`) silently dedupes any retried publish — confirmed by sending a second SMS on the same conversation and observing `count=1` on the matching idempotency key. SMS and WhatsApp had never previously fired this event; both now accepted + processed cleanly.

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
