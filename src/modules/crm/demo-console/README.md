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

## Tickets referencing this README

A-1, A-2, A-3, B-1, B-2, B-3, C-1..C-4, D-1..D-5, E-1..E-6, F-1..F-4, G-1.
See [.claude/plans/okay-create-a-plan-merry-russell.md](../../../../../.claude/plans/okay-create-a-plan-merry-russell.md)
in the user-level plans directory for the full plan and current status.
