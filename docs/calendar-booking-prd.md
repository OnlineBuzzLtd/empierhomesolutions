# PRD — Calendar booking issue: mock test runs are squatting on production slots

**Created**: 2026-05-13
**Author**: shaz@onlinebuzz.co.uk (via real customer call against `empire-home-solutions-managed-production`)
**Status legend**: 🔴 not started · 🟡 in progress · 🟢 done · ⚪ blocked
**Severity**: `P0` blocks revenue / customer comms · `P1` important within ~2 weeks · `P2` cleanup / nice-to-have
**Effort**: `XS` <1h · `S` half day · `M` 1–2 days · `L` 3–5 days · `XL` >1 week

---

## Context

A real customer call landed on the production agent this afternoon:

```
Customer: Hi, I'm having an issue with my boiler, so I just need an emergency callout please.
[…all identity captured cleanly: name, phone, address EN10 6PD, email…]
Agent:    I'm sorry, it seems we don't have any emergency callout slots available for the rest of today.
Customer: Is there anything available tomorrow?
Agent:    I'm sorry, there are no emergency callout slots available for tomorrow either.
Customer: If you could find the next emergency callout slot please.
Agent:    Unfortunately, there are no emergency callout slots available for the next week.
Customer: Yeah, thanks, bye.
```

**Result: lost emergency-callout booking, real revenue impact.** The customer is a known contact (shaz@customerjourneys.ai, 07396824192) so this is a confirmed lost lead, not a synthetic test artefact.

## Root cause (confirmed via code read)

The platform-api's calendar availability check (`platform-repository.ts:2408 isTimeRangeAvailable`) treats **every booking row on a resource as a conflict, regardless of source**. There is no filter for `is_test`, no separate test-resource convention, and no expiry on confirmed test bookings.

The Tier 1 testing infrastructure shipped today (`MESSAGING_ADAPTER=mock`) only suppresses **outbound Twilio traffic**. The mock-adapter revision still:

- Writes real booking rows into the platform-api Postgres `bookings` table.
- Calls through to Empire's CRM `CalendarAdapter` (`/api/platform/calendar/events/[bookingId]/confirm`) which materialises `crm.appointments` rows in Empire's Supabase.
- Emits `BookingConfirmed` events to the CRM webhook.

Today's validation pass on the mock revision was 3× consecutive **10/10** runs (`docs/agent-reliability-prd.md` addendum). That's ~30 confirmed emergency-callout / boiler-service bookings claimed against the same shared engineer resource (`da488c5b-72d3-440f-a1bf-b4e70d0d3332`). They consumed every available slot for the next 7+ days. Shaz's real call couldn't find a slot because the test runs are squatting on them.

**Evidence in the test runner**: every scenario uses identifiable test markers (`sarah.sms.<runId>@test.com`, `david.wp.<runId>07@test.com`, etc., name patterns from a fixed pool). These bookings are trivially distinguishable from real customer bookings.

## Architecture invariants (must hold for any fix)

- The platform-api booking table is the source of truth for slot availability.
- Empire's `crm.appointments` is the source of truth for engineer-facing diary work.
- Both must agree — divergence creates orphan jobs.
- Mock-mode test data must NEVER prevent a real customer from booking.
- Cleanup operations must be **idempotent** and **safe to re-run**.
- Cleanup must NEVER delete a non-test booking, even if mis-tagged.

---

# Epic — Decontaminate the calendar and prevent recurrence

## 🔴 CAL-001 · Diagnose: count and identify test bookings polluting production

**Severity**: P0 · **Effort**: XS · **Depends on**: none

**Problem.** We need a definitive list of which bookings on the calendar are mock-test pollution vs real customers BEFORE we delete anything. Acting on a hypothesis without a confirmed count risks deleting a real booking.

**Scope.**
- Write a **read-only** diagnostic script `scripts/diagnose-test-booking-pollution.mts` that:
  - Queries Empire's `crm.appointments` for the next 30 days where the linked `crm.customers` row has either:
    - `email` matching `/(sarah\.sms|david\.wp|alice\.wp|tom\.webchat|mark\.sms|priya\.web|linda\.voice|james\.voice|john\.smith)\.\d+@test\.com$/` (the patterns in `scripts/live-empire-channel-tests.mts`)
    - OR `phone` starting with `+447645990` / `+447559121` / `+447818142` / `+447743589` (test runId prefixes)
  - Cross-references with the platform-api Postgres `bookings` table where status = `confirmed` AND `start_time` is in the future.
  - Outputs: per-resource, per-day count of suspected test bookings vs real bookings.
- Add a `--dry-run` mode that's the default; no writes anywhere.

**Acceptance criteria.**
- Running the script produces a clear report showing N test bookings and M real bookings for the next 30 days, grouped by resource.
- The script identifies the specific date range where test bookings are blocking real slots.
- ZERO writes performed.

**Test plan.**
1. Run against the production data plane.
2. Manually verify 5 random "test" matches by spot-checking the customer record — should all be obvious synthetic identities.
3. Manually verify 5 random "real" matches — should be real-looking phone numbers / emails.

**Rollback.** N/A — read-only.

---

## 🔴 CAL-002 · Restore: cancel test bookings to free real slots

**Severity**: P0 · **Effort**: S · **Depends on**: CAL-001

**Problem.** With the test bookings identified, free them so real customers can book again. Must NOT delete the rows (audit trail) — instead mark them cancelled so they no longer block availability.

**Scope.**
- Extend `scripts/diagnose-test-booking-pollution.mts` with a `--cancel` mode that:
  - For each identified test booking, sets `bookings.status = 'cancelled'` on the platform-api side AND posts a DELETE to `crm.appointments` via the platform-bridge calendar route (`/api/platform/calendar/events/[bookingId]` DELETE — already idempotent, see `webhooks.ts:404` chain).
  - Adds a structured log line per row including the booking id, resource id, slot start, customer email.
  - Refuses to run unless `--confirm-cancel-bookings=I-AM-SURE` is passed (two-step guard).
- Treat `--cancel` runs as **Tier 3**-equivalent under CLAUDE.md's live-testing rules: surface the count + cost + scope to the operator and require explicit go.

**Acceptance criteria.**
- After running, `isTimeRangeAvailable` returns `available: true` for the slots that were previously blocked by the test bookings.
- A subsequent call to the production agent for an emergency callout returns concrete slot offers within the next 24 hours.
- The cancelled bookings remain in the audit log with `status = 'cancelled'`.
- No real customer's booking is touched (verified by post-run diff against CAL-001's report).

**Test plan.**
1. Run `scripts/diagnose-test-booking-pollution.mts` first to confirm the target list.
2. Run with `--cancel --confirm-cancel-bookings=I-AM-SURE`.
3. Re-run the diagnostic — expected count of remaining test bookings: 0.
4. Manually trigger an availability search via the live channel test against the mock revision (zero outbound) — expect concrete slots offered for emergency-callout in the next 7 days.

**Rollback.** Booking status transitions are recorded; restore by setting `status = 'confirmed'` on the cancelled rows. Cleaner: have the `--cancel` mode write the prior status to `bookings.metadata.previous_status` so rollback is mechanical.

---

## 🔴 CAL-003 · Prevent: tag mock-adapter bookings as test data at creation

**Severity**: P0 · **Effort**: M · **Depends on**: none (but logically follows CAL-002)

**Problem.** Without a structural fix, the next mock-adapter test run repollutes the calendar. The Tier 1 architecture currently solves the carrier-reputation dimension but not the shared-state dimension.

**Scope.**
- Add a new column `bookings.is_test boolean not null default false` to the platform-api Postgres schema (additive migration, no backfill needed — rows default to false).
- In `services/platform-api/src/routes/webhooks.ts`, when `process.env.MESSAGING_ADAPTER === 'mock'`, pass `isTest: true` through the booking creation path to `repository.createBookingHold()`.
- Threading: `bookings.is_test` propagates through to the CRM bridge POST — add an `is_test` flag in the `BookingConfirmed` event payload.
- Empire CRM side: extend `crm.appointments.metadata` (jsonb) to carry `is_test: true` when present in the inbound event. Add a partial index `crm.appointments(is_test) WHERE is_test = true` for fast filtering.
- Update `platform-repository.ts:isTimeRangeAvailable` to filter: `WHERE status = 'confirmed' AND is_test = false` so test bookings DO NOT block availability for real customers.

**Acceptance criteria.**
- A mock-adapter test run creates `bookings` rows with `is_test = true`.
- A simultaneous real-customer booking is unaffected: the test bookings don't appear as conflicts.
- After running 3× mock test passes (10/10 each), production availability for emergency-callout on the next day is unchanged from the pre-test baseline.
- A new unit test `platform-repository-availability-is-test.test.ts` asserts the filter.

**Test plan.**
1. Apply the migration locally; verify schema.
2. Run `pnpm exec vitest run platform-repository-availability-is-test.test.ts` — green.
3. Deploy to the mock revision; run a single Tier 1 test cycle.
4. Manually query `bookings` — confirm the new rows have `is_test = true`.
5. Run availability search via a non-mock client against the same slot — expect available.

**Rollback.** Roll the migration back with `alter table bookings drop column if exists is_test;` Code-level rollback: env var `MOCK_BOOKING_IS_TEST=off` short-circuits the tagging so the column is written as `false` for mock runs (degrades back to today's behaviour rather than failing).

**Out of scope (call out to user).**
- Renaming or restructuring the Tier 1 mock revision tag (`mock---...`). The same env var keeps working.
- A separate test-only resource_id / engineer (could be cleaner architecturally but is L-effort and not needed for the immediate fix).

---

## 🔴 CAL-004 · Auto-cleanup: nightly job to expire stale test bookings

**Severity**: P1 · **Effort**: S · **Depends on**: CAL-003

**Problem.** Even with `is_test = true` tagging, the audit trail will accumulate orphan test rows indefinitely. We want an automated cleanup so test-only data doesn't bloat the production DB.

**Scope.**
- Add a Cloud Scheduler job in the CustomerJourneys workers service: runs daily at 03:00 UTC.
- Action: for each `bookings` row where `is_test = true` AND `start_time < now() - interval '24 hours'`, set `status = 'expired'` and emit a `BookingExpired` event to CRM (idempotent).
- Empire CRM receives the `BookingExpired` event → soft-delete the matching `crm.appointments` row (set `status = 'expired'`, don't hard-delete; engineers occasionally need a record of "this was a test").

**Acceptance criteria.**
- After running, the bookings table has 0 active test bookings older than 24 hours.
- The Empire diary doesn't show expired test bookings.
- A new unit test confirms the cleanup query.

**Test plan.**
1. Seed test bookings with old `start_time`.
2. Run the cleanup function directly.
3. Verify status transition.

**Rollback.** Pause the Cloud Scheduler job. Test bookings will simply accumulate but never affect availability (CAL-003 already protects that).

---

## 🔴 CAL-005 · Update CLAUDE.md: codify "Tier 1 must not pollute shared state"

**Severity**: P1 · **Effort**: XS · **Depends on**: CAL-003 shipped

**Problem.** Today's CLAUDE.md "Live testing against paid third-party providers" section addresses **carrier reputation and provider cost**, but doesn't address **shared-state pollution** (calendar slots, CRM rows, etc.). The May 13 incident proves Tier 1 mock-adapter testing can still cause real-world failure modes when it shares a data plane with production.

**Scope.**
- Add a sub-bullet under the Tier 1 description: *"Tier 1 must also not pollute production-shared state. Bookings, leads, and customer rows created during Tier 1 runs must be tagged (`is_test = true`) so availability and capacity queries can exclude them, OR must be written to a separate test data plane (separate tenant, separate resource, separate schema)."*
- Add a one-liner reference to `CAL-003` as the implementation of this rule for the booking calendar.

**Acceptance criteria.**
- CLAUDE.md is updated, committed, and pushed.
- Future agents reading CLAUDE.md don't repeat the May 13 mistake.

---

## Sequencing recommendation

1. **CAL-001 first** (XS, P0, read-only). Confirms the diagnosis before any writes. Output goes to the user for review.
2. **CAL-002** (S, P0). Only run after the user reviews CAL-001's report and approves the cancellation list.
3. **CAL-003** (M, P0). Structural fix so this can't recur. Includes migration, code change in both repos, redeploy.
4. **CAL-004** (S, P1). Janitorial. Nice-to-have but CAL-003 alone protects availability.
5. **CAL-005** (XS, P1). Doc update so future agents follow the new rule.

**Total time-to-restored-bookings: 1-2 hours** (CAL-001 + CAL-002). Total time-to-structural-fix: half a day.

## Verification (whole epic)

After all five tickets ship:

1. Run `scripts/diagnose-test-booking-pollution.mts` — expects 0 test bookings active on the production calendar.
2. Run the live channel test suite against the mock revision — expect 10/10. The new `is_test = true` tagging means these bookings exist but don't block.
3. Make a real call to the production agent (or use a known-real test phone) for an emergency callout — expect concrete slot offers in the next 24 hours.
4. Verify the engineer diary in Empire's `/diary` doesn't show test customers.

## Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| CAL-002 cancellation accidentally targets a real booking | Low | Diagnostic-first; two-step `--confirm-cancel-bookings=I-AM-SURE` guard; preserve rows with `status = 'cancelled'` not DELETE; status transition is reversible. |
| CAL-003 migration locks the bookings table | Low | Single nullable additive column; PostgreSQL handles this with metadata-only DDL on modern versions. |
| Mock test runs after CAL-003 start failing because the test harness reads its own bookings back as conflicts | Medium | Mock test scenarios already use distinct synthetic phone numbers per run; AGT-006b auto-availability would surface this fast. Add a regression test that runs 2× mock cycles back-to-back and confirms 10/10 both times. |
| CAL-004 cleanup races with an in-flight test run | Low | Filter on `start_time < now() - interval '24 hours'`. Test runs use future-dated slots so they wouldn't match the cleanup predicate. |
| Empire `crm.appointments.metadata` change affects engineer-app reads | Low | Additive jsonb key; engineer-app already ignores unknown metadata keys. |

## Open questions

1. **Cancellation method for CAL-002.** Cancel via direct SQL update on `bookings.status`, OR via the platform-bridge calendar DELETE endpoint (which propagates to Empire)? Default proposal: bridge DELETE — it keeps both sides in sync via existing tested code. SQL update is a fallback if the bridge fails on individual rows.
2. **Notification on cancellation.** Do cancelled test bookings need to suppress any "your booking was cancelled" SMS to the test phone numbers? Default proposal: yes, by adding a `suppress_customer_notification` flag — but mock-adapter means no SMS goes out anyway, so this is moot for the affected rows.
3. **Future-dated real bookings to protect.** If a real customer booked an emergency-callout for tomorrow before this incident, are there any? The diagnostic in CAL-001 will surface this — manual review before CAL-002 runs.

## Out of scope

- Replacing the booking persistence layer.
- Adding a separate "test tenant" with its own engineer (could be a CAL-006 if `is_test` tagging proves insufficient).
- Mock-mode for the CRM side (Empire's appointment system) — `is_test` tagging on `crm.appointments.metadata` is enough.
- The agent reliability work (AGT-001 → AGT-007) — tracked separately in `agent-reliability-prd.md`.

---

## Verification command (after CAL-001 ships)

```bash
node scripts/diagnose-test-booking-pollution.mts
# Reports: N test bookings, M real bookings, blocked slot count per day
```

After CAL-002 ships:

```bash
node scripts/diagnose-test-booking-pollution.mts --cancel --confirm-cancel-bookings=I-AM-SURE
# Cancels test bookings, prints per-row log, re-runs the diagnostic at the end
```

After CAL-003 ships, the Tier 1 verification command from the agent reliability PRD continues to work and is now safe to repeat:

```bash
PLATFORM_API_URL="https://mock---customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app" \
  npx tsx scripts/live-empire-channel-tests.mts
```

It can now be re-run as many times as needed without polluting production availability.

---

## Awaiting approval before implementation

Per your instruction: **no code changes yet**. This plan is for your review. On approval, I'll execute in the recommended order, pausing after CAL-001 to share the diagnostic output before any writes happen in CAL-002.
