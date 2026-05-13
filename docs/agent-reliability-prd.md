# PRD — Agent reliability: stabilising `live-empire-channel-tests` at 9-10/10

**Created**: 2026-05-13
**Author**: shaz@onlinebuzz.co.uk (via live channel testing pass)
**Status legend**: 🔴 not started · 🟡 in progress · 🟢 done · ⚪ blocked
**Severity**: `P0` blocks revenue / customer comms · `P1` important within ~2 weeks · `P2` cleanup / nice-to-have
**Effort**: `XS` <1h · `S` half day · `M` 1–2 days · `L` 3–5 days · `XL` >1 week

---

## Context

Six end-to-end live runs of `scripts/live-empire-channel-tests.mts` produced **6/10 to 7/10 passing**, with variance across scenarios. After exhaustive harness-side fixes (HE-054b literal-affirmative safety net, smarter CRM-evidence polling, transcript front-loading, plumbing-pack `boiler-installation` service) and a Tier 1 mock-adapter infrastructure (`MESSAGING_ADAPTER=mock` → zero Twilio outbound), the ceiling stays at ~6-7/10. **Reaching stable 9-10/10 requires real agent engineering in the CustomerJourneys platform-api repo.** Fully deterministic 10/10 on every run is not the target for this PRD while the router remains LLM-driven.

What's already shipped (DO NOT redo):
- `services/platform-api/src/lib/booking-stages/confirm-stage.ts` HE-054b literal-affirmative safety net (commits `25d3977e`, `a69052e0`) — 22/22 unit tests pass.
- `packages/integrations/src/messaging/mock.ts` MockMessagingAdapter + env-var-driven selector in `webhooks.ts` (commit `09197932`) — enables Tier 1 testing.
- `packages/vertical-config/src/default-packs/plumbing.ts` registers `boiler-installation` (commit `8df1850a`).
- Empire CRM test harness improvements (commits `186b6c8`, `26b322d`, `2b9ab61`, `69c0913`).
- **AGT-001** Deterministic identity-extraction pre-pass (CustomerJourneys commits leading to `a932b5bf`) — 12+ positive + 6+ negative test cases passing. Gated by `IDENTITY_EXTRACTOR=off`. Live; partially helps T7. **Insufficient to lift score alone — see remaining bottleneck below.**
- **AGT-005** Tier 3 Twilio guard in `scripts/live-empire-channel-tests.mts` (Empire commit `ef9e7dc`) — refuses to run without `ALLOW_LIVE_TWILIO=1`, auto-allows URLs containing `mock---`. May 12 incident impossible to recur.
- **AGT-006** Deterministic scheduling pre-pass (CustomerJourneys commit `06e48bad`) — 17 tests passing. Writes `pendingDateIso`, `preferredDateText`, `preferredTimeWindow`, `preferredExplicitTime`, `preferredSlotOrdinal` to `bookingState.collectedData.textRuntime`. Gated by `SCHEDULING_EXTRACTOR=off`. Live but **not effective** — see Confirmed bottleneck below.
- **AGT-006b** Auto check_availability when scheduling hint complete (CustomerJourneys, same commit chain as 006b deploy) — synthesizes concrete UTC start/end from `pendingDateIso + preferredTimeWindow + service duration`, calls `checkAvailability()` directly. Gated by `SCHEDULING_AUTO_AVAIL=off`. Live but rarely fires (gating too tight; service must be classified before date message lands).

## Confirmed reliability ceiling (2026-05-13 measurements)

Six Tier 1 runs against the `mock---` revision with various combinations of the above:

| State of agent | Booking-path PASS rate |
|---|---|
| Pre-AGT (Twilio live) | 6-7/10 (variance) |
| AGT-001 only | 6/10 |
| AGT-001 + AGT-006 | 5/10 |
| AGT-001 + AGT-006 + AGT-006b | 5/10 |

Voice channel + escalation + info-only scenarios are stable 5/5 across every run. The 4 booking-path scenarios that should book (T1, T4, T7, T9) flake between green and red on the same transcripts.

**Confirmed bottleneck**: the LLM availability-stage system prompt receives only the user payload — it does NOT read `bookingState.collectedData.textRuntime` from context when building its turn. AGT-006 and AGT-006b therefore write data the LLM never sees. Evidence: T1 transcript shows agent saying "to hold that slot" (sees the hint *somewhere*) then later "What date and time would you like?" (the prompt for the next turn doesn't include it). The pre-pass approach has reached its limit.

## Root cause (revised from live-transcript analysis)

The agent's LLM-based intent + identity classifier is **non-deterministic** and frequently mis-routes customer inputs to wrong fields. Once misclassification happens, the state machine has no recovery — it keeps asking the wrong question, storing wrong values. Evidence from the mock-adapter T3 run (which removes Twilio variance entirely):

```
[customer] EMERGENCY callout — Alice Thompson, 45 Victoria Road, London W1A 1AA
[AI]       Could you send the next detail for the booking?      ← extracted nothing

[customer] alice.wp.X@test.com
[AI]       What is your full name?                              ← still doesn't know name

[customer] The burst pipe is in the bathroom
[AI]       Thanks Alice. What's your postcode?                  ← stored as name

[customer] Today as soon as possible
[AI]       I have the date. What time works best?

Final state captured:  name = "Today as soon as possible"       ← time stored as name
```

T4 (Webchat) shows a parallel service-classification failure — customer asks about "boiler servicing", agent quotes Emergency Callout pricing. The whole conversation runs under wrong service classification.

The 2-service → 3-service plumbing pack change (adding `boiler-installation`) likely **destabilised** the router by adding LLM ambiguity (3 plausible classifications instead of 2). T9 went from 0/4 → 1/1 → flake after the change.

## Architecture invariants (must hold for any fix)

- The agent state machine is **state-driven, not message-driven** — every customer reply must be classified into a state transition. Misclassification → wrong transition → wrong question.
- `bookingState.waitingFor` is the source of truth for "what does the agent still need to collect". `confirm-stage.ts` already gates on this correctly via `identityComplete()`.
- `crm.platform_event_log.BookingConfirmed` only fires when `outcomeStatus === "confirmed"` (see `text-runtime-publish.ts:61`). That outcome requires `confirmBooking()` to return successfully (not throw). `confirmBooking()` validates required identity fields at `platform-repository.ts:2089-2106` — if any required field is missing, it throws.
- For Empire (plumbing vertical), `deriveRequiredIdentityFields()` at `platform-repository.ts:758-773` returns 5 fields for SMS/WhatsApp emergency, 4 for voice. **These requirements are not negotiable** — the engineer needs an address to dispatch.

---

# Epic — Agent reliability uplift

## 🟢 AGT-001 · Deterministic identity-extraction pre-pass (SHIPPED 2026-05-13)

**Severity**: P0 · **Effort**: M · **Depends on**: none

**Problem.** When the customer says "EMERGENCY callout please — Alice Thompson, 45 Victoria Road, London W1A 1AA" in turn 1, the LLM identity-extraction step regularly fails to populate `customer_name`, `customer_address`, and `customer_postcode`. Then it asks for them one-by-one over multiple turns and frequently misclassifies subsequent replies (storing a service-description string in `customer_name`, etc.). Highest-leverage single fix — adding a pre-LLM regex pass that extracts unambiguous patterns from every customer turn would catch the obvious cases the LLM is missing.

**Scope.**
- New module `services/platform-api/src/lib/identity-extractor.ts` exporting a pure function `extractDeterministicIdentity(messages: string[]): DeterministicIdentityPatch`.
- `DeterministicIdentityPatch` returns two plain objects:
  - `identity: Partial<Identity>` — the existing identity field shape; do not change stored identity fields from strings into objects.
  - `sources: Partial<Record<keyof Identity, "deterministic">>` — provenance metadata, stored separately from field values.
- Patterns to extract (conservative, no false positives):
  - **UK postcode**: `/\b([A-PR-UWYZ][A-HK-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i` (matches `W1A 1AA`, `EC1A 1BB`, `N1 9AB` etc.)
  - **Email**: standard RFC-relaxed `/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i`
  - **Full name**: heuristic — capitalised two-word run NOT immediately preceded by a service noun and NOT overlapping an extracted address, postcode, city, provider/business phrase, or geographic phrase. Confidence: medium; only sets `customer_name` if not already set.
  - **Address**: house number + street word + (city + postcode), e.g. `45 Victoria Road, London W1A 1AA`. Pattern: `/\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Road|Street|Avenue|Lane|Close|Way|Drive|Court|Place|Gardens|Square|Crescent|Hill|Park)\b/i` followed by optional comma + city + postcode.
- Extraction order matters:
  1. Extract postcode and email.
  2. Extract address and record its character span.
  3. Remove/ignore already-extracted spans before looking for a name.
  4. Reject name candidates containing service, time, urgency, provider/business, or location-only terms.
- Wire it into `managed-text-agent.ts` immediately after the customer's message is received, BEFORE the LLM router/identity stage runs. Pre-populates `bookingState.collectedData.identity` with extracted fields. The LLM stage then operates on a partially-filled state — its job is fill the gaps, not re-extract everything.
- Store provenance separately, e.g. `bookingState.collectedData.identitySources.customer_name = "deterministic"`. Do not mutate the persisted identity field shape unless the platform already has a metadata slot for this.

**Acceptance criteria.**
- Customer message containing `Alice Thompson, 45 Victoria Road, London W1A 1AA` populates `customer_name`, `customer_address`, `customer_postcode` deterministically — agent does not subsequently ask for them.
- Customer message containing `alice.wp.X@test.com` populates `customer_email`.
- "The burst pipe is in the bathroom" does NOT populate any identity field (no false positives).
- "Today as soon as possible" does NOT populate `customer_name` (no false positives on time phrases).
- "Victoria Road", "Boiler Service", "British Gas", "North London", and "Bayswater" do NOT populate `customer_name`.
- All existing unit tests pass unchanged.
- New unit tests: 12+ cases covering the patterns above + 6+ negative cases (service descriptions, time phrases, single names, etc.).

**Test plan.**
1. `npx vitest run services/platform-api/src/lib/identity-extractor.test.ts` (new file).
2. `npx vitest run services/platform-api/src/lib/managed-text-agent.test.ts` (existing).
3. Tier 1 live run after deploy: expect T3 and T9 to flip stable green; T1/T4 likely improve.

**Rollback.** Env var `IDENTITY_EXTRACTOR=off` short-circuits the pre-pass (no-op). Worst case: revert the single file in `managed-text-agent.ts` that calls it.

---

## 🔴 AGT-002 · Service-classification stability guard

**Severity**: P1 · **Effort**: S · **Depends on**: none

**Problem.** `service-stage.ts` `capture_service_patch` re-classifies the service mid-conversation. Observed in T7: customer says "boiler service" → agent classifies as `boiler-service` → customer adds details → agent re-classifies as `emergency-callout` mid-flow → slot offered for old service, booking attempts with new one → loop.

**Scope.**
- In `services/platform-api/src/lib/booking-stages/service-stage.ts`, when a `serviceKey` is already set in `bookingState.collectedData.service`, only allow re-classification if the new classification has **high** router confidence (`>= 0.85`; if the router does not expose confidence today, add it before enforcing this guard) AND the new key differs from the existing by more than "service variant".
- Define service families in the plumbing pack or a colocated helper:
  - `boiler`: `boiler-service`, `boiler-installation`
  - `emergency`: `emergency-callout`
- Allow `boiler-service` ↔ `boiler-installation` before slot offer when confidence is high. Do not allow `boiler-*` → `emergency-callout` unless the latest customer message contains an emergency trigger from the vertical pack's `urgencyKeywords` or the hard fallback list.
- Add a `serviceClassificationLocked` flag to `bookingState.collectedData.service` that turns true once `availabilityChecked === true` (i.e. once we've offered a slot, the service is locked).

**Acceptance criteria.**
- T7 transcript no longer flips service mid-conversation. Booking confirms for `boiler-service` as initially classified.
- Service can still be corrected EARLY (before slot offered) if the LLM router is high-confidence about a change AND the customer's latest message contains an emergency trigger word.
- Existing tests pass.

**Test plan.**
1. Unit test: `service-stage.test.ts` — re-classification with low confidence is ignored; high-confidence cross-classification still works; post-slot re-classification rejected.
2. Tier 1 run: T7 flips green.

**Rollback.** Single-file revert in `service-stage.ts`.

---

## 🔴 AGT-003 · Conversation-history identity reconciliation pass

**Severity**: P1 · **Effort**: M · **Depends on**: AGT-001 ideally landed first

**Problem.** Even after AGT-001 catches identity from individual messages, the state machine has no recovery when an early message was misclassified (e.g., service description stored as name). Periodically the agent should re-parse the full conversation history with the deterministic extractor and correct misclassified fields.

**Scope.**
- New helper `reconcileIdentityFromHistory()` in `identity-extractor.ts` (shared with AGT-001) that takes the full conversation history and the current `bookingState.collectedData.identity` and corrects:
  - If `customer_name` looks like a non-name pattern (matches a time phrase, service description, or contains a known service keyword) AND the history contains a valid name pattern elsewhere → overwrite.
  - If `customer_address` is null but history contains an address → fill.
  - Etc.
- Run this reconciliation pass at every state transition (cheap, idempotent).

**Acceptance criteria.**
- A conversation where turn 1 had identity but turn 3's reply got misclassified into the name field is auto-corrected.
- Reconciliation never destroys valid LLM-extracted data — it only overrides obvious misclassifications.
- Identity-stage tests pass.

**Test plan.**
1. Unit test cases: name=service-description gets corrected; name=time-phrase gets corrected; valid name is not touched.
2. Tier 1 run: T3 flips green; T1/T4 reliability improves.

**Rollback.** Env var `IDENTITY_RECONCILE=off` disables the pass.

---

## 🔴 AGT-004 · LLM router prompt tightening for 3-service plumbing pack

**Severity**: P1 · **Effort**: S · **Depends on**: none

**Problem.** Adding `boiler-installation` to the plumbing pack (May 12) added a third plausible classification to a router that was previously choosing between 2. T7 / T4 show the router now over-eagerly classifies non-emergency boiler enquiries as `emergency-callout`. The router's system prompt needs updated examples and stronger disambiguation for the 3-service catalog.

**Scope.**
- `services/platform-api/src/lib/booking-router.ts` system prompt — add 6-8 new few-shot examples specifically covering:
  - `"I need a boiler service"` → `book` intent, `boiler-service` service
  - `"new boiler quote please"` → `book` intent, `boiler-installation` service
  - `"burst pipe URGENT"` → `book` intent, `emergency-callout` service
  - Mixed cases: `"my boiler is broken, can you fix it today?"` → likely `emergency-callout` if "today" / "today as soon as possible" present
- Add a negative example: `"do you cover boiler servicing"` → `enquire`, NOT `book emergency-callout`.

**Acceptance criteria.**
- `tests/unit/booking-router-classification.test.ts` (new): 30+ classification examples, ≥90% match expected service/intent.
- Tier 1 run: T4 stops mis-quoting Emergency Callout pricing for boiler-service enquiries.

**Test plan.**
1. Cassette-based unit tests for the router parser/contract and representative cached LLM responses.
2. Live/manual eval script for the 30 classification examples against the current model + prompt. This is allowed to be slower/costly and should not run in normal CI.
3. Tier 1 run: T4/T7 stabilise.

**Rollback.** Revert the prompt file. Cheap.

---

## 🟢 AGT-005 · Test-harness Tier 1 enforcement guard (SHIPPED 2026-05-13)

**Severity**: P0 · **Effort**: XS · **Depends on**: none

**Problem.** `scripts/live-empire-channel-tests.mts` will route through the production Twilio number if `PLATFORM_API_URL` isn't overridden. The May 2026 incident (150+ failed messages, error 21211) happened because the script ran without operator awareness of the cost/compliance implications.

**Scope.**
- Print a 6-line warning banner at script start: "TIER 3 RUN — about to fire real Twilio traffic against {account_sid}, {messaging_number}. Cost ~£X. Press Ctrl+C in 10 seconds to abort."
- Refuse to run unless `ALLOW_LIVE_TWILIO=1` is set OR `PLATFORM_API_URL` contains `mock---` (tagged mock revision auto-recognised as Tier 1).

**Acceptance criteria.**
- Without env var or mock URL: script exits with error code 1 + clear instructions on how to run Tier 1 vs Tier 3.
- With mock URL: script runs immediately, no banner, no countdown.
- With `ALLOW_LIVE_TWILIO=1`: banner shown, 10s countdown, then runs.

**Test plan.**
1. Run three times: without flag, with flag, with mock URL. Verify the three behaviours.

**Rollback.** Single-file revert.

---

## Sequencing recommendation

1. **AGT-005** first (XS, immediate compliance/cost guard for future test runs).
2. **AGT-001 + AGT-003 design pass** (M, shared extractor/reconciler API + provenance shape). AGT-003 can still ship after AGT-001, but the state shape must be designed once.
3. **AGT-001 implementation** (M, highest leverage; lifts T3, T9, partially T1/T4).
4. **AGT-004** (S, fixes T4 misrouting; small win).
5. **AGT-002** (S, fixes T7; depends on AGT-001 being clean).
6. **AGT-003 implementation** (M, lifts T1/T4 to consistent green via state recovery).
7. Final Tier 1 validation run — expect 9-10/10. The remaining flake (if any) is LLM stochasticity at the router level which AGT-004 should mitigate to <5%.

**Total estimated effort: 5-7 days of focused agent engineering** (vs my earlier 7-11 hours estimate, which was based on the incomplete diagnosis from a single Explore-agent pass).

## Verification (whole epic)

After all five tickets ship, run the Tier 1 suite (`PLATFORM_API_URL=<mock URL> npx tsx scripts/live-empire-channel-tests.mts`) **three times consecutively**:

- All 3 runs must show **≥9/10**.
- At least 1 run must show **10/10**.
- T2 (escalation), T5/T6/T10 (voice), T8 (info-only) must remain 100% green (locked-in current behaviour).

If the median over 5 runs lands at 9/10 with occasional 10/10, declare the epic complete. 100% consistent passing is not achievable without removing LLM non-determinism entirely (which would require swapping the router for a deterministic state machine — out of scope, much larger work).

## Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| AGT-001 regex extracts false positives that corrupt valid identity | Medium | Conservative patterns (anchored, full-match, no greedy quantifiers). Each pattern has ≥3 negative test cases. |
| AGT-002 service-lock prevents legitimate corrections | Low | Lock only triggers after slot offered; pre-slot corrections still allowed. |
| AGT-003 reconciliation overwrites valid LLM extractions | Medium | Only override fields whose current value matches a clear misclassification pattern. Never null-out a field. |
| AGT-004 prompt changes regress non-plumbing tenants | Low | Prompt is plumbing-vertical-specific (per existing scaffold). Other verticals (dental, etc.) have their own prompt path. |
| LLM still flakes after all fixes | Medium | Document the residual variance band honestly. 9/10 with 5% flake is the practical ceiling for LLM-driven agents. |

## Out of scope

- Replacing the LLM router with a deterministic state machine. Would eliminate variance but loses natural-language flexibility — not the trade-off this product wants.
- Voice-side reliability (already 100% — don't touch).
- Cross-vertical changes (this PRD is plumbing-only).
- WhatsApp emergency-callout SLA / dispatch policy.
- The platform→CRM webhook bridge itself (it's working when `outcomeStatus === "confirmed"` — the fix is upstream, making `outcomeStatus` more reliable).

## Open questions

1. **AGT-001 false-positive tolerance.** If the regex pre-pass occasionally over-extracts (e.g., treats "Bayswater" as a name fragment), is that acceptable? Default proposal: no for names. Name extraction should fail closed; postcode/email/address can be deterministic, but names need conservative span filtering and negative cases.
2. **AGT-002 emergency keyword list.** Hard-code `["burst", "leak", "urgent", "emergency", "asap", "now"]` or read from the vertical pack's `urgencyKeywords`? Default proposal: read from pack, with the hard-coded list only as a fallback if the pack field is unavailable.
3. **AGT-003 reconciliation frequency.** Run on every turn, or only at state transitions? Default proposal: every turn — it's cheap (regex-only) and the cost of missing a correction is high (locks state into bad value).
4. **Cassette-based router tests (AGT-004).** Acceptable to commit cached LLM responses, or should tests be live-LLM (slow + costly)? Default proposal: commit cassettes, with a manual refresh script for when the model version changes.

---

# Addendum — 2026-05-13 measurements + next-step priorities

After AGT-001 + AGT-006 + AGT-006b shipped and were measured against the Tier 1 mock revision, the booking-path PASS rate is **5-6/10 across multiple runs**. The pre-pass approach has plateaued. The dominant remaining failure modes:

1. **LLM availability-stage doesn't see `textRuntime` hints.** The stage's user payload is built from the customer body + minimal state; `bookingState.collectedData.textRuntime` is invisible. AGT-006's writes are dead-letter for the stage that needs them most. **This is the next ticket to land.**

2. **Service-classification mid-conversation drift** (the T7 "Boiler Service vs Emergency Callout" loop) is the next biggest scoring delta after #1. Still tracked as **AGT-002** above.

3. **`bookingState.collectedData.identity` synthesis from `addressLine1` + `city` + `postcode`** sometimes fails when the LLM populates only `addressLine1`. Confirmed at `platform-repository.ts:2074-2086`. AGT-003-style reconciliation would catch this.

## 🔴 AGT-007 · Inject textRuntime hints into LLM stage payloads (next priority)

**Severity**: P0 · **Effort**: M · **Depends on**: AGT-006 (shipped)

**Problem.** The LLM availability-stage system prompt and user payload don't include `bookingState.collectedData.textRuntime` fields (`pendingDateIso`, `preferredDateText`, `preferredTimeWindow`, `preferredExplicitTime`, `preferredSlotOrdinal`). AGT-006 writes these fields, but the LLM can't read them when deciding whether to call `check_availability`. Result: same conversation keeps asking "What date and time would you like?" even though state has the date.

**Scope.**
- Find the availability-stage payload builder (likely in `managed-text-agent.ts` or `booking-stages/availability-stage.ts`).
- Add a `bookingContext` block to the LLM user payload containing populated textRuntime scheduling hints + serviceKey + identityComplete flag.
- Update `AVAILABILITY_STAGE_SYSTEM_PROMPT` to explicitly read from `bookingContext` and call `check_availability` whenever `bookingContext.pendingDateIso` is set with a non-null time hint.
- Mirror the same approach for `identity-stage.ts` and `service-stage.ts` so hints propagate consistently.

**Acceptance criteria.**
- After deploying, T1/T4/T9 transcripts no longer show "What date and time would you like?" after the customer has named a date.
- 3 consecutive Tier 1 runs land **≥8/10**, with at least 1 hitting **9/10**.
- No regression on voice (T5/T6/T10), escalation (T2), or info-only (T8).
- New unit test: `managed-text-agent-payload-context.test.ts` proves textRuntime hints flow into the LLM payload.

**Test plan.**
1. `npx vitest run services/platform-api/src/lib/managed-text-agent-payload-context.test.ts`.
2. Deploy via `node scripts/production/deploy-cloudrun.mjs`, re-tag mock revision, run Tier 1.

**Rollback.** Env var `INJECT_TEXT_RUNTIME=off` short-circuits the payload addition.

## 🔴 AGT-006c · Loosen auto-availability gating (low-cost incremental)

**Severity**: P2 · **Effort**: XS · **Depends on**: AGT-006b

**Problem.** AGT-006b's auto check_availability requires service to be classified BEFORE the date message lands. In practice the customer often gives date AND service in the SAME message, but service classification runs AFTER the pre-pass, so the gating misses every time.

**Scope.**
- In `prefillDeterministicScheduling`, when `service` isn't classified but `pendingDateIso` + a time hint are set, infer the most likely service from the customer body using the same deterministic catalog matcher `service-stage.ts` uses. If a unique match exists, use it.
- Otherwise, fall back to a default 60-min duration and skip the service-key arg to `check_availability` — the calendar resource handles the default.

**Acceptance criteria.**
- T1/T4/T9 transcripts show `check_availability` firing in the FIRST customer turn that contains a date.
- Existing AGT-006b unit tests still pass.

**Rollback.** Single-file revert.

## Updated sequencing (next 2-3 days)

1. **AGT-007** (M, P0) — payload context injection. The next biggest single lever.
2. **AGT-006c** (XS, P2) — loosen gating.
3. **AGT-002** (S, P1) — service-classification stability guard.
4. **AGT-003** (M, P1) — identity reconciliation.
5. **AGT-004** (S, P1) — router prompt tightening, if needed after above.
6. Three consecutive Tier 1 runs to validate ≥9/10 with one 10/10.

## Verification handoff command

```bash
# Quick health check of current production agent (Tier 1, zero cost):
PLATFORM_API_URL="https://mock---customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app" \
  npx tsx scripts/live-empire-channel-tests.mts
```

Expected current state: 5-6/10 booking-path passing, 9-10/10 overall (counting T2 + T8 on their non-booking predicates). The mock revision has all of AGT-001 + AGT-006 + AGT-006b live; production traffic is unaffected (mock is `--no-traffic`).
