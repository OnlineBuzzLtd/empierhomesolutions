# Demo Console

Tenant-scoped, in-person sales demo capability inside the Empire CRM. Used by
the operator (you) on a MacBook to show a plumber prospect the full
lead-to-booking flow across all channels: Google Lead Ads, Meta Lead Ads,
webchat, voice, SMS, WhatsApp.

This README is the source of truth for two things future contributors keep
needing:

1. **The phone-number policy** that protects the Twilio sender reputation.
2. **The local staging recipe** for running the demo console on a laptop.

It is also the conceptual entry point — every demo-console ticket in
`.claude/plans/okay-create-a-plan-merry-russell.md` assumes you have read
this file.

---

## Phone number policy (read first)

The Twilio sender reputation is **already at 52/100 (Poor)** after the May 12
and May 14 2026 incidents in which automated test runs fired real SMS to
synthetic UK-format numbers, all of which bounced. See [CHANGELOG.md](../../../../CHANGELOG.md)
and [CLAUDE.md](../../../../CLAUDE.md) ("Live testing against paid third-party
providers") for the full account.

### The only phone numbers allowed during development

| Use | What you may use | What you may NOT use |
|---|---|---|
| Unit / integration tests | Twilio Magic Numbers (`+15005550006` family) | Any synthetic UK-format number, even one you "just made up" |
| Manual smoke tests against staging | Magic Numbers OR a number on `DEMO_CONSOLE_ALLOWLIST` | Anything else |
| Real prospect demo (production) | A number on `DEMO_CONSOLE_ALLOWLIST` (yours, the consenting plumber's after capture, etc.) | Anything else |

`/api/platform/events` enforces this with [synthetic-number-guard.ts](../../../platform/lib/synthetic-number-guard.ts).
A request whose phone field matches a banned pattern returns HTTP 422 with
`{ code: "synthetic_number_blocked", pattern, field }`. There is no
"override for one-off testing" — add yourself to the allowlist instead.

### `DEMO_CONSOLE_ALLOWLIST` format

Comma-separated list of full E.164 numbers, no spaces required (they are
trimmed). Example `.env.local` block:

```sh
# Demo Console — allowlist of phone numbers that the synthetic-number
# guard will let through /api/platform/events. Use full E.164.
# Add yourself before running any end-to-end demo against staging or prod.
DEMO_CONSOLE_ALLOWLIST=+447700900123,+447700900456
```

Twilio Magic Numbers (`+15005550006` etc) are always allowed and do NOT need
to appear on the allowlist.

### Twilio subaccount matrix

| Environment | Twilio account | Sender number | Notes |
|---|---|---|---|
| Local dev (laptop) | TODO — populate after **A-2** ships | Magic Numbers only | See "Local staging" below. Refuses to boot against prod Twilio in non-prod NODE_ENV. |
| Staging / preview deploys | TODO — populate after **A-2** | Demo subaccount sender | Lives behind allowlist; daily messaging cap configured on the messaging service. |
| Production demos | TODO — populate after **A-2** | Demo subaccount sender (NOT the main Empire customer-comms sender) | Carrier reputation is per-sender; demo traffic is isolated from real-customer comms. |

> **Pending: A-2 (Twilio ops task).** This table is intentionally incomplete
> until the dedicated demo Twilio subaccount has been provisioned. Until
> then, the demo console must not be pointed at any Twilio account in
> `NODE_ENV=production`. See ticket A-2 in the plan file.

### What to do when you discover a new bad pattern

If a new round of bounces traces back to a phone-number shape that the
guard does not block, add the prefix to `KNOWN_SYNTHETIC_PREFIXES` in
[synthetic-number-guard.ts](../../../platform/lib/synthetic-number-guard.ts).
Open a PR with a one-line summary referencing the Twilio Insights screenshot.
Do **not** silently widen the allowlist as a workaround.

---

## Local staging recipe

> The rest of this section will be expanded by tickets C-1, D-1, E-2, F-3,
> and F-4. For now it documents the minimum needed to develop on the
> safety scaffolding (Stream A + B).

### Prerequisites

- `pnpm install` at the repo root.
- A `.env.local` populated from `.env.example` plus the variables below.
- For any test that touches Twilio: the dedicated demo Twilio subaccount
  credentials (pending A-2).

### Required env vars for the demo console

```sh
# Already required for the rest of the app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PLATFORM_SHARED_SECRET=...

# New for the demo console
DEMO_CONSOLE_ALLOWLIST=+447700900123                # see above

# Pending A-2 — leave unset for now
# DEMO_TWILIO_ACCOUNT_SID=AC...
# DEMO_TWILIO_AUTH_TOKEN=...
# DEMO_VOICE_NUMBER=+44...
# DEMO_SMS_NUMBER=+44...
# DEMO_WHATSAPP_NUMBER=whatsapp:+44...
# DEMO_DAILY_CAP=20
```

### Running locally

```sh
pnpm dev
# then open http://localhost:3000/demo
```

The `/demo` route is tenant-gated (ticket C-1). Until ticket B-2 ships, no
tenant has `demo_console_enabled = true`, so the route 404s. After B-2,
the Empire tenant is seeded `true` and a Plumbersrus session 404s.

### Running the safety tests

```sh
pnpm vitest run tests/unit/synthetic-number-guard.test.ts
```

This is the only test that **must** stay green for the demo-console work
stream to be safe to deploy. CI runs it on every PR.

---

## Operating principles (the "why" behind the guard rails)

1. **Reputation damage compounds.** A single bad day of 30453 errors moved
   the sender score 40 points. Recovery has not happened. Every demo
   bounce now lands on a sender that carriers are already watching.
2. **"Just one test send" is the trap.** The May incidents were caused by
   exactly this. The synthetic-number guard exists to make "just one"
   mechanically impossible from this code path.
3. **Demos are real traffic.** Even with `is_test=true` and the cleanup
   endpoint, a confirmed booking fires real Twilio downstream. The
   guard does not change that — it only stops the destination from being
   a number that will bounce.
4. **No new `live-*` / `e2e-*` / `*-channel-test*` scripts in this work
   stream.** Verification routes through the `/demo` UI with the guard
   active. Per [CLAUDE.md](../../../../CLAUDE.md), the existing scripts
   in `scripts/` are the documented cause of the original damage —
   do not add more.

---

## Running a demo (F-3 runbook)

### Pre-meeting checklist (do once per day before any demo)

1. **Preflight green.** Open `/demo/run`, expand the preflight strip in the header. All four checks should be `ok` or `skipped`. If `twilio` is `skipped`, that's expected until A-2 ships — your demo can still run but you won't get a Twilio reputation score check in the banner.
2. **DEMO_CONSOLE_ALLOWLIST contains your number** AND any test partner who'll receive SMS/WA during the demo. Verify via the preflight `env` line.
3. **Demo Twilio subaccount health.** Open Twilio Insights for the demo subaccount in another tab. Score should be the expected baseline (target ≥80). If it's poor, don't pitch from this sender — investigate before running.
4. **Browser cache cleared / private window**, so a previous session's cookies don't leak in.
5. **You have the prospect's phone number ready** and have explained to them out loud that one SMS and one WhatsApp will arrive during the demo.

### Channel demo order (recommended)

A 5–7 minute run that covers the full story. Adjust based on what the prospect's interested in.

1. Open `/demo/run` fullscreen. Show the right-hand "Live CRM" pane sitting idle — "Waiting for the first lead…".
2. Press `Ctrl+Shift+D` to open the operator panel. **Fill in the consent form**: prospect's name + mobile, read the consent text out loud, check the box, click **Start demo session**.
3. **Webchat** (lowest friction). Hand the laptop to the prospect: "Try typing what you'd say if your boiler broke." Watch the right pane fill in — customer card, lead card, then a booking appointment.
4. **Google lead** (you trigger). In the operator panel, click **Google lead**. Right pane shows the new customer arrive within a couple of seconds.
5. **Meta lead** (you trigger). Same shape, different channel badge.
6. **SMS / WhatsApp**. Point at the messaging tile. "Now text us from your phone." Prospect texts, the AI replies on their phone, an SMS/WA confirmation lands when the booking confirms. Right pane shows the appointment row.
7. **Voice**. Point at the voice tile. "Now call us." Prospect dials from their mobile, the AI receptionist answers, books them in, right pane lights up.
8. Show the prospect their own confirmation SMS / WhatsApp on their phone, and the booking on the live pane. Story complete.

### Post-meeting cleanup (do every time)

1. In the operator panel, click **End session & wipe demo rows**.
2. The confirmation modal shows what will be deleted. Click **Yes, wipe**. The trigger log adds a "Cleanup: deleted N rows across M tables" line.
3. Open `/dashboard` and confirm the prospect's records are gone (customers, leads, jobs, appointments). Plumbersrus / other tenants are untouched.
4. If you ran a demo that triggered a real Twilio issue: hit **Stop all demo triggers** in the operator panel before leaving the room. That sets the kill switch — clear it later from the operator panel once you've investigated.

### Things to NOT do

- Don't run another demo without clearing the previous session (the operator panel auto-closes any prior active session, but the first demo's rows linger until you cleanup).
- Don't share `/demo` or `/demo/run` URLs with prospects after the meeting; the routes only resolve while signed in to the demoing tenant.
- Don't add prospect numbers to `DEMO_CONSOLE_ALLOWLIST` permanently. The allowlist exists for your test phones and pre-consented partners; prospect consent is recorded on the `demo_sessions` row for that session only.

### Webchat cleanup gap (E-7 pending)

Bookings made through the **webchat** tile during a demo show up in the live pane (since the 2026-05-18 filter widening — `tests/unit/should-include-row.test.ts`), but the underlying customer / lead / job / appointment rows are NOT tagged `is_test=true` because the public webchat → CJ runtime path doesn't propagate that flag. **The end-session cleanup endpoint won't wipe them.** Workarounds until E-7 lands:

1. After end-of-session cleanup, run a manual delete via `/customers` for the demo prospect rows the cleanup missed.
2. Or run a one-off cleanup script that filters by `source = 'ai_webchat'` and `created_at >= sessionStartedAt`.
3. Or just accept the accumulation — they're tagged `source = "ai_webchat"` so they're identifiable for periodic bulk cleanup.

The Google / Meta replay triggers and the voice / SMS / WhatsApp paths all go through `/api/platform/events` with `is_test=true` baked in, so cleanup catches those without effort. The gap is webchat-only.

---

## Tickets referencing this README

A-1, A-2, A-3, B-1, B-2, B-3, C-1..C-4, D-1..D-5, E-1..E-6, F-1..F-4, G-1.
See [.claude/plans/okay-create-a-plan-merry-russell.md](../../../../../.claude/plans/okay-create-a-plan-merry-russell.md)
in the user-level plans directory for the full plan and current status.
