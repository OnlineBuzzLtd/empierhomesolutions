# Multi-Agent Architecture — How the System Works and How It Feeds CRM

**Created**: 2026-05-13
**Author**: shaz@onlinebuzz.co.uk
**Related docs**: `CRM_AGENTIC_AI_TECHNICAL_MANUAL.md` (operational), `agent-reliability-prd.md` (engineering tickets), `README.md`.

> One-line summary: a customer message lands on Twilio / WhatsApp / Webchat / ElevenLabs voice → the **platform-api** (Cloud Run, in the CustomerJourneys repo) classifies it through a small LLM router, dispatches to one of seven **stage sub-agents**, persists state in Postgres, then emits signed events to the **CRM webhook** which materialises rows in `crm.platform_event_log`, `crm.customers`, `crm.leads`, `crm.appointments`, and `crm.jobs`.

---

## 1. Top-level map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CUSTOMER CHANNELS                                │
│                                                                             │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────────┐               │
│  │  SMS    │  │ WhatsApp │  │ Webchat │  │ Voice (managed)  │               │
│  │ Twilio  │  │  Twilio  │  │  HTTP   │  │  ElevenLabs      │               │
│  └────┬────┘  └─────┬────┘  └────┬────┘  └────────┬─────────┘               │
└───────┼────────────┼───────────┼─────────────────┼─────────────────────────┘
        │            │           │                 │
        │ POST       │ POST      │ POST            │ POST /v1/managed-voice/
        │ /v1/webhooks/twilio/sms (SMS+WhatsApp)   │  elevenlabs/...
        │            │           │ /v1/webchat/    │
        ▼            ▼           ▼ messages        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  platform-api  (Cloud Run, europe-west2)                    │
│            CustomerJourneys repo · services/platform-api/                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Step 1 — DETERMINISTIC PRE-PASSES  (run before any LLM call)        │    │
│  │   • prefillDeterministicIdentity()    AGT-001 → identity-extractor  │    │
│  │   • prefillDeterministicScheduling()  AGT-006 → scheduling-extractor│    │
│  │   • prefillDeterministicScheduling() may auto-call check_availability│   │
│  │   Output: writes to bookingState.collectedData.{identity,textRuntime}│   │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Step 2 — BOOKING-ROUTER  (Haiku 4.5, prompt-cached)                 │    │
│  │   booking-router.ts                                                 │    │
│  │   Classifies inbound into 11 intents:                               │    │
│  │     affirmative · negative · bare_time · bare_date                  │    │
│  │     handoff_signal · book · reschedule · cancel · enquire           │    │
│  │     off_script · noise                                              │    │
│  │   Short-circuits on three high-confidence cases:                    │    │
│  │     handoff_signal → direct createHandoff                           │    │
│  │     affirmative + hold + identity complete → direct confirmBooking  │    │
│  │     noise → suppress LLM, deterministic fallback                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Step 3 — STAGE DISPATCHER  (state-driven, not message-driven)       │    │
│  │   Reads bookingState.currentState, hands to the matching handler:   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│        ┌────────┬──────────┬─┴────────┬───────────────┬─────────────┐       │
│        ▼        ▼          ▼          ▼               ▼             ▼       │
│  ┌────────┐┌────────┐┌───────────┐┌─────────────┐┌───────────┐┌─────────┐   │
│  │capturin││capturin││capturing_ ││checking_    ││awaiting_  ││confirmed│   │
│  │g_intent││g_servic││identity   ││availability ││slot_confir││_pending_│   │
│  │        ││e_detail││           ││             ││mation     ││notifs   │   │
│  ├────────┤├────────┤├───────────┤├─────────────┤├───────────┤├─────────┤   │
│  │intent- ││service-││identity-  ││availability-││confirm-   ││post-    │   │
│  │stage.ts││stage.ts││stage.ts   ││stage.ts     ││stage.ts   ││booking- │   │
│  │        ││        ││           ││             ││           ││stage.ts │   │
│  │ LLM    ││ DETERM ││ LLM       ││ LLM         ││ DETERM    ││ DETERM  │   │
│  │ Haiku  ││ catalog││ +pre-pass ││ +tools      ││ +HE-054b  ││         │   │
│  │ +tools ││ matcher││ +tools    ││             ││ safety net││         │   │
│  └────────┘└────────┘└───────────┘└─────────────┘└───────────┘└─────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Step 4 — TOOL EXECUTION  (each stage has a narrow tool subset)      │    │
│  │   capture_intent · capture_service · capture_identity · capture_slot│    │
│  │   check_availability · search_availability                          │    │
│  │   create_hold · confirm_booking · create_handoff · lookup_pricing   │    │
│  │   think (no-op reasoning marker)                                    │    │
│  │   Tools mutate Postgres state via PlatformRepository                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Step 5 — REPLY VERIFIER  (second LLM pass — gates the draft reply)  │    │
│  │   reply-verifier.ts                                                 │    │
│  │   Reads customer message + draft reply + tool calls                 │    │
│  │   Emits {verdict, repairs[]} — repairs are applied and a fresh      │    │
│  │   reply is composed before sending to the customer.                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Step 6 — OUTBOUND ADAPTER                                           │    │
│  │   webhooks.ts → buildMessagingAdapter()                             │    │
│  │     · Default: TwilioMessagingAdapter (api.twilio.com)              │    │
│  │     · MESSAGING_ADAPTER=mock: MockMessagingAdapter (in-memory)      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Step 7 — PLATFORM EVENT EMISSION                                    │    │
│  │   text-runtime-publish.ts                                           │    │
│  │   When outcomeStatus === "confirmed" → emit BookingConfirmed        │    │
│  │   Other events: ConversationStarted, ConversationQualified,         │    │
│  │     MissedCallCaptured, EscalationRaised, BookingCompleted          │    │
│  │   crm-platform-events.ts POSTs HMAC-signed JSON to                  │    │
│  │   CRM_PLATFORM_EVENTS_URL → https://empire-home-solutions.vercel.   │    │
│  │     app/api/platform/events                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│         State persistence: Postgres (platform-side)                         │
│         Workers (BullMQ): customerjourneys-workers — async fan-out          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Signed POST (per-event idempotency_key)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EMPIRE CRM  (Vercel, empire-home-solutions)             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Webhook receiver — /api/platform/events                             │    │
│  │   src/app/api/platform/events/route.ts                              │    │
│  │   1. HMAC verify · 2. Idempotency check against                     │    │
│  │      crm.platform_event_log (unique on tenant+source+idemp_key)     │    │
│  │   3. Insert envelope · 4. Hand to command executor                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Command executor — src/modules/platform/lib/command-executor.ts     │    │
│  │   Maps incoming events → CRM commands and applies them:             │    │
│  │     MatchCustomerByChannelIdentity                                  │    │
│  │     LinkConversationToCustomerOrJob (runs FIRST on BookingConfirmed)│    │
│  │     CreateOrUpdateLeadFromConversation                              │    │
│  │     CreateOrUpdateAppointment (self-heals customer_id if missing)   │    │
│  │     CreateCallbackTask                                              │    │
│  │   Customer-merge rule: latest non-empty payload wins (2026-05-09).  │    │
│  │   Identity keys: both camelCase + snake_case accepted (2026-05-09). │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ CRM tables (Supabase Postgres, `crm` schema)                        │    │
│  │   platform_event_log         · audit trail, idempotency             │    │
│  │   platform_conversation_links · conv ↔ customer/lead/job binding   │    │
│  │   customers                  · master customer record               │    │
│  │   leads                      · qualified opportunities              │    │
│  │   appointments               · scheduled engineer visits            │    │
│  │   jobs                       · materialised work orders             │    │
│  │   job_assignments            · which engineer is allocated          │    │
│  │   conversations / messages   · captured for inbox replay            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Engineer + admin surfaces                                           │    │
│  │   /diary (engineer field app)  · /jobs · /leads · /quotes           │    │
│  │   /inbox · /calendar · /reports · /dashboard                        │    │
│  │   Field-app workflow: Arrive → Leave Questions → Complete           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component breakdown

### 2.1 Channels (inbound)

| Channel | Entry point on platform-api | Carrier |
|---|---|---|
| SMS | `POST /v1/webhooks/twilio/sms` | Twilio Messaging |
| WhatsApp | `POST /v1/webhooks/twilio/sms` (channel = `whatsapp`) | Twilio Conversations / WhatsApp Business |
| Webchat | `POST /v1/webchat/messages` | Direct HTTP from the website widget |
| Voice (managed) | `POST /v1/managed-voice/elevenlabs/conversation-init` then realtime websocket | ElevenLabs managed-voice agent (handles ASR + TTS) |

**Tier 1 testing path**: the test script posts directly to `/v1/webhooks/twilio/sms` with a fake `MessageSid` and an `x-internal-service-token` header. Outbound is routed through `MockMessagingAdapter` when `MESSAGING_ADAPTER=mock`. Zero carrier traffic.

### 2.2 Pre-pass extractors (deterministic, run before any LLM)

- **`identity-extractor.ts`** (AGT-001 shipped 2026-05-13). Pure regex pass on every incoming customer turn. Extracts:
  - UK postcode (`/\b([A-PR-UWYZ][A-HK-Y]?[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i`)
  - Email
  - Full name (heuristic, anchored on capitalised two-word run; rejects service / location / time terms)
  - Address (number + street + optional city + postcode)
  - Writes to `bookingState.collectedData.identity`. Gated by `IDENTITY_EXTRACTOR=off`.
- **`scheduling-extractor.ts`** (AGT-006 shipped 2026-05-13). Pure regex pass. Extracts:
  - Date — `today`, `tomorrow`, weekday names, `May 15` / `15 May` / `next Friday`
  - Time-of-day window — morning / afternoon / evening / tonight
  - Explicit clock time — `9am`, `2:30pm`, `14:00`
  - Slot ordinal — `the third slot`, `second slot`, `first option`, `slot 3`
  - ASAP / urgency phrases — `as soon as possible`, `soonest`, etc.
  - Writes to `bookingState.collectedData.textRuntime.{pendingDateIso, preferredDateText, preferredTimeWindow, preferredExplicitTime, preferredSlotOrdinal, asapRequested}`. Gated by `SCHEDULING_EXTRACTOR=off`.
- **AGT-006b auto-availability** (shipped 2026-05-13). When `pendingDateIso` + a time hint + service are all set, the pre-pass directly invokes `checkAvailability()` rather than waiting for the LLM availability-stage to call it. Gated by `SCHEDULING_AUTO_AVAIL=off`.

### 2.3 Booking router (intent classifier sub-agent)

- File: `services/platform-api/src/lib/booking-router.ts`.
- Model: Anthropic Claude **Haiku 4.5** (`claude-haiku-4-5-20251001`).
- Prompt cached (`booking-router` cache control); reads only the latest inbound message + minimal state context.
- Output shape: `{ intent, confidence: low|medium|high, summary }`.
- Three short-circuit paths skip the rest of the agent loop entirely (handoff_signal high, affirmative high with hold+identity, noise high).
- HE-054b safety net (in confirm-stage) overrides router uncertainty when the literal message matches an unambiguous YES pattern.

### 2.4 Stage handlers (the six sub-agents)

Each handler is registered in `booking-stages/registry.ts` and dispatched by `booking-stages/dispatcher.ts` based on the current `bookingState.currentState`.

| Stage | State | Type | Tools | Notes |
|---|---|---|---|---|
| Intent | `capturing_intent` | LLM (Haiku) | `capture_intent`, `think` | Maps free text to a routing intent. |
| Service | `capturing_service_details` | **Deterministic** catalog matcher | `capture_service` | No LLM — word-boundary match against the tenant's `services[]`. Ambiguity → clarification prompt. |
| Identity | `capturing_identity` | LLM + pre-pass | `capture_identity`, `think` | LLM fills gaps the deterministic pre-pass missed. Recovery loop self-heals missed fields. |
| Availability | `checking_availability` | LLM with narrow tool subset | `check_availability`, `search_availability`, `think` | Two-tool stage. Picks `check_availability` for concrete date+time, `search_availability` for ranges. |
| Confirm | `awaiting_slot_confirmation` | **Deterministic** + HE-054b safety net | `create_hold`, `confirm_booking`, `create_handoff` | Router-verdict-driven. HE-054b overrides on literal YES patterns when the router returns non-actionable verdicts. |
| Handoff | `handoff_required` | Deterministic | `create_handoff` | Terminal-ish: hands the conversation to a human queue. |
| Post-booking | `confirmed_pending_notifications` | Deterministic | (none) | Finalises confirmations, triggers SMS / email notifications. |

### 2.5 Reply verifier (second-pass safety LLM)

- File: `services/platform-api/src/lib/reply-verifier.ts`.
- Runs after the stage handler produces a draft reply. Reads `{customerMessage, draftReply, toolCalls}` and emits a verdict + repair instructions.
- Catches: contradiction with tool results, missing identity confirmation, leaking unconfirmed promises ("I've booked you for…" when no `create_hold` ran), etc.
- Repairs are applied and a fresh reply is composed before anything goes to the customer.

### 2.6 Outbound adapter

- `buildMessagingAdapter()` in `webhooks.ts`.
- Two implementations:
  - **`TwilioMessagingAdapter`** — production default. POSTs to `api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`.
  - **`MockMessagingAdapter`** — `MESSAGING_ADAPTER=mock`. Records sends in-memory; never HTTPs Twilio. Enables Tier 1 integration testing with zero carrier impact.
- Tagged Cloud Run revision: `mock---customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app` — serves 0% of production traffic but has `MESSAGING_ADAPTER=mock` set, allowing safe integration tests on demand.

### 2.7 Platform → CRM event emission

- `text-runtime-publish.ts:61` — emits `BookingConfirmed` only when `outcomeStatus === "confirmed"` AND `bookingId` is present. Other events fire on their own conditions (`ConversationStarted` on first inbound, `MissedCallCaptured` on voice no-answer, etc.).
- `crm-platform-events.ts` builds the canonical envelope (event_id, event_type, version, workspace_id, occurred_at, source_system, idempotency_key, correlation_id, causation_id, aggregate, payload) and POSTs to `CRM_PLATFORM_EVENTS_URL`.
- HMAC signature: SHA-256 over the body, sent as `x-platform-signature` header. Shared secret stored in GCP Secret Manager.
- **Fire-and-log**: never throws; failed delivery is logged but doesn't block the booking confirmation.

---

## 3. CRM side — how the event becomes a job

### 3.1 Receiver (Empire repo)

- `src/app/api/platform/events/route.ts` accepts the POST.
- Verifies HMAC.
- Checks idempotency against `crm.platform_event_log` (`UNIQUE (tenant_id, source_system, idempotency_key)`). Duplicates silently dedupe.
- Inserts the envelope into `crm.platform_event_log` and hands to the command executor.

### 3.2 Command executor

File: `src/modules/platform/lib/command-executor.ts`. Maps event types to CRM commands:

```
ConversationStarted
   → MatchCustomerByChannelIdentity   (find or create customer by phone/email)
   → LinkConversationToCustomerOrJob  (seed crm.platform_conversation_links)

ConversationQualified
   → CreateOrUpdateLeadFromConversation (lead row, status=qualified)

BookingConfirmed
   → LinkConversationToCustomerOrJob  (RUNS FIRST — ensures the link exists)
   → CreateOrUpdateAppointment        (self-heals customer_id if missing)
   → CreateOrUpdateLeadFromConversation (back-attaches lead.customer_id)

EscalationRaised
   → CreateCallbackTask

MissedCallCaptured
   → CreateCallbackTask
```

Customer-merge invariant (set 2026-05-09): **latest non-empty payload value wins.** Empty / null values never overwrite an existing field. Snake_case and camelCase identity keys both accepted (CJ ships `customer_full_name`; legacy paths send `customerName`).

### 3.3 CRM tables touched

| Table | Role |
|---|---|
| `crm.platform_event_log` | Audit trail, idempotency anchor. Schema: `tenant_id, source_system, idempotency_key, event_type, aggregate_id, payload jsonb, created_at`. |
| `crm.platform_conversation_links` | Conversation ↔ customer/lead/job binding. Fields: `conversation_id, customer_id, lead_id, job_id, callback_appointment_id, booking_appointment_id, latest_channel`. |
| `crm.customers` | Master record. Merge rule above. |
| `crm.leads` | Qualified opportunities; status flows `new → qualified → booked → won/lost`. |
| `crm.appointments` | Engineer visits. Materialised from `BookingConfirmed`. |
| `crm.jobs` | Work order tied to an appointment; engineers see these on `/diary`. |
| `crm.job_assignees` | Which engineer is allocated. Auto-populated from `booking_resource_id` on the inbound event (since 2026-04-16). |
| `crm.conversations`, `crm.messages` | Captured for the `/inbox` replay surface. |

### 3.4 Engineer + admin surfaces (read paths)

| Route | Purpose |
|---|---|
| `/diary` | Engineer field-app daily list. Pulls from `crm.appointments` + `crm.jobs`. |
| `/jobs/[id]` | Job detail. Workflow: Arrive → No Access / Abort / Leave Questions → Complete. |
| `/leads` | Inbound funnel — every conversation that produced a lead. |
| `/quotes` | Quote builder. Packages live at `/settings/packages`. |
| `/inbox` | Cross-channel conversation replay. |
| `/calendar` | Tenant-wide schedule view. |
| `/reports` | Workload + outcome reporting. |

---

## 4. End-to-end trace — one booking, four channels condensed

```
1. Customer: "Hi I need a boiler service please. I'm Sarah Brown,
              22 Old Street, London EC1A 1BB"
       │
       │ POST /v1/webhooks/twilio/sms  (Twilio webhook for SMS,
       │   or direct HTTP for webchat, or managed-voice init for voice)
       ▼
2. PRE-PASS:
   identity-extractor extracts: { fullName: "Sarah Brown",
                                  address: "22 Old Street, London EC1A 1BB",
                                  postcode: "EC1A 1BB" }
   scheduling-extractor: (no date/time in this message — empty patch)
   Writes to bookingState.collectedData.identity

3. ROUTER (Haiku):
   intent = "book", confidence = "high"
   No short-circuit (not affirmative/handoff/noise)

4. DISPATCHER:
   state = capturing_service_details → ServiceStage

5. SERVICE-STAGE (deterministic):
   matches "boiler service" → service-key "boiler-service"
   tool: capture_service → bookingState.collectedData.service set
   transition: capturing_service_details → capturing_identity

6. (next turn) Customer: "Friday afternoon"
   pre-pass scheduling-extractor: pendingDateIso = 2026-05-15,
                                  preferredTimeWindow = "afternoon"
   AGT-006b auto-availability fires (service classified, date+time set):
     → check_availability returns Fri 15 May 14:00–15:30 available
     → bookingState.collectedData.slot.normalizedStartTime set
   transition: → awaiting_slot_confirmation

7. (next turn) Customer: "YES please confirm"
   ROUTER: affirmative, high
   Identity complete? Yes (pre-pass got everything from turn 1).
   Hold present? Yes.
   → SHORT-CIRCUIT to direct confirmBooking

8. CONFIRM-STAGE:
   tool: confirm_booking → booking.status = "confirmed"
   outcomeStatus = "confirmed"

9. POST-BOOKING:
   text-runtime-publish.ts: emit BookingConfirmed event
   crm-platform-events.ts: POST HMAC-signed envelope to
     https://empire-home-solutions.vercel.app/api/platform/events

10. CRM:
    /api/platform/events receives, HMAC-verifies, idempotency-checks.
    crm.platform_event_log: INSERT event row.
    command-executor:
      - LinkConversationToCustomerOrJob (ensures link exists)
      - CreateOrUpdateAppointment (writes crm.appointments row)
      - CreateOrUpdateLeadFromConversation (writes crm.leads row,
          back-attaches customer_id)
    Engineer `/diary` now shows the booking.
```

---

## 5. Where reliability has historically gone wrong (current bottlenecks)

These are the live findings as of 2026-05-13 (tracked in `agent-reliability-prd.md`):

| Symptom | Root cause | Fix status |
|---|---|---|
| Same transcript flips pass/fail across runs | LLM router (Haiku) is non-deterministic on short affirmatives | HE-054b safety net shipped; ~70% of cases now stable |
| Agent forgets a date the customer already named | LLM availability-stage payload doesn't include `bookingState.collectedData.textRuntime` | AGT-007 (open) — inject hints into payload |
| Service drifts mid-conversation (boiler-service → emergency-callout) | `service-stage` re-classification when not locked | AGT-002 (open) — slot-locking guard |
| Identity field misclassified ("Today as soon as possible" stored as name) | LLM identity-stage stores raw last message when uncertain | AGT-001 partly fixes; AGT-003 reconciliation pass (open) |
| `BookingConfirmed` never reaches CRM despite platform booking | Emergency-callout requires 5 identity fields; LLM didn't validate before `confirm_booking` | Partly fixed by AGT-001's identity pre-pass; AGT-003 to reconcile from history |

Voice (T5, T6, T10 in the live channel test) is 100% reliable — it has different orchestration and benefits from ElevenLabs' built-in entity extraction.

---

## 6. Tier 1 testing infrastructure (zero cost, safe to rerun)

```bash
# Validates the entire flow against the tagged mock-adapter revision.
# Zero outbound Twilio. Zero carrier impact. Free.
PLATFORM_API_URL="https://mock---customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app" \
  npx tsx scripts/live-empire-channel-tests.mts
```

The script runs 10 scenarios across all four channels. Inbound is webhook injection; outbound is mock. Reads `crm.platform_event_log` to verify the full inbound → CRM materialisation flow worked.

Test-script guard (`AGT-005`): the script refuses to run against the production Twilio path unless `ALLOW_LIVE_TWILIO=1` is set. URLs containing `mock---` auto-allow.

---

## 7. Out-of-scope surfaces (related but separate from the multi-agent flow)

- **Customer Journeys SaaS site** (`customerjourneys-site/apps/site/`) — the marketing + B2B leadgen frontend on Vercel. Uses Firebase Firestore for its own collections (`audit_requests` from the contact form, etc.). Separate data plane from the booking agent.
- **Workers** (`customerjourneys-workers`) — BullMQ background jobs for async fan-out (notification dispatch, calendar sync, etc.). Triggered by the platform-api, not by customer messages directly.
- **Voice gateway** (`customerjourneys-voice-gateway`) — terminates Twilio Voice + ElevenLabs streams. Separate Cloud Run service.
- **CRM platform-bridge** (`src/app/api/platform/calendar/events/[bookingId]/...`) — REST surface the platform-api uses to hold / confirm / cancel / lookup events against the CRM's canonical calendar. Accepts both `bookingId` (legacy) and `providerReference` (the CRM appointment id) as of 2026-05-12.

---

## 8. References

- Engineering tickets to reach 9-10/10 reliability: [`agent-reliability-prd.md`](./agent-reliability-prd.md)
- Operational runbook: [`CRM_AGENTIC_AI_TECHNICAL_MANUAL.md`](./CRM_AGENTIC_AI_TECHNICAL_MANUAL.md)
- Compliance rules for live testing: [`../CLAUDE.md`](../CLAUDE.md) (section "Live testing against paid third-party providers")
- Live agent runtime health: `https://customerjourneys-platform-api-424400851565.europe-west2.run.app/health`
- Tier 1 mock revision: `https://mock---customerjourneys-platform-api-cnz7crlx2a-nw.a.run.app/health`
