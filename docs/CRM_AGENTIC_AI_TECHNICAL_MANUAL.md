# CRM + Agentic AI Technical Manual

This document explains how the Empire Home Solutions CRM and Agentic AI platform work together, from UI surfaces to API orchestration, data storage, event processing, security, and test coverage.

---

## 1) System Overview

The system is a multi-tenant CRM with an event-driven integration layer that connects front-desk conversations (webchat, voice, SMS, WhatsApp) to CRM outcomes (leads, jobs, appointments, customer linkage, and review workflows).

At a high level:

1. Conversations and operational signals are represented as **platform events**.
2. Platform events are validated and translated into **platform commands**.
3. Commands are executed against CRM domain records.
4. Conversation-to-CRM links and timeline records are stored for observability and manual correction.
5. Outbound CRM-origin events are queued and published using an outbox pattern.

---

## 2) Core Architecture

### 2.1 Application Layer (Next.js App Router)

Primary CRM UI surfaces live under `src/app/(crm)`.

- `src/app/(crm)/layout.tsx`: CRM shell, role-aware navigation, session routing, demo state handling.
- `src/app/(crm)/inbox/page.tsx`: front-desk queue and operator workflow for linked conversations and review cases.
- `src/app/(crm)/calls/page.tsx`: missed-call recovery operations.
- `src/app/(crm)/automations/page.tsx`: event/command automation observability.
- `src/app/(crm)/ai-settings/page.tsx`: AI policy/settings surface.
- `src/app/(crm)/ai-hub/page.tsx`: AI Hub landing and gated paths.
- `src/app/(crm)/ai-hub/live/page.tsx`: live channel testing and runtime-linked front-desk experience.

Standard CRM operational modules are also in this layer:

- Customers, jobs, quotes, invoices, calendar, reports, settings, staff, auth pages.

### 2.2 Integration Layer (Platform)

Platform contracts, processing, and persistence live under `src/modules/platform`.

- `src/modules/platform/contracts.ts`: canonical event/command vocabulary and envelope schemas.
- `src/modules/platform/lib/integration.ts`: event-to-command derivation logic.
- `src/modules/platform/lib/processor.ts`: orchestration of event handling, command scheduling/execution, status updates.
- `src/modules/platform/lib/command-executor.ts`: CRM mutations per command type.
- `src/modules/platform/lib/repository.ts`: data access for event logs, command logs, links, aliases, and outbox.
- `src/modules/platform/lib/outbox.ts`: durable outbound event queue and publish retry behavior.
- `src/modules/platform/lib/review.ts`: review-state and unresolved-link logic.

### 2.3 CRM Runtime Bridge Layer

Runtime and AI bridge logic lives under `src/modules/crm/lib`.

- `auth.ts`: CRM auth/session resolution and tenant role gating.
- `api.ts`: shared API helpers for authenticated route enforcement.
- `env.ts`: system configuration contract (Supabase, platform secrets, live-agent, CustomerJourneys).
- `customerjourneys.ts`: CustomerJourneys runtime link/readiness/sync and webchat bridge.
- `ai-hub-live-agent.ts`: managed live-agent adapter with typed response/error handling.
- `ai-hub-live.ts`: live session orchestration and platform event emission from conversation turns.
- `tenants.ts`: tenant/workspace bootstrap and linkage setup.

---

## 3) Front Desk + CRM End-to-End Data Flow

```mermaid
flowchart TD
  frontDeskUI[FrontDeskUI /ai-hub/live or /inbox] --> crmApi[CRM_API_Routes]
  crmApi --> liveAgentBridge[LiveAgentBridge]
  crmApi --> cjBridge[CustomerJourneysBridge]
  liveAgentBridge --> platformEvents[PlatformEventEnvelope]
  cjBridge --> platformEvents
  platformEvents --> eventsRoute[/api/platform/events]
  eventsRoute --> processor[processPlatformEvent]
  processor --> integrationRules[deriveCommandsFromEvent]
  integrationRules --> commandExecutor[executePlatformCommand]
  commandExecutor --> crmTables[(CRM Domain Tables)]
  commandExecutor --> convoLinks[(platform_conversation_links)]
  processor --> eventAndCommandLogs[(platform_event_log + platform_command_log)]
  crmTables --> inboxUi[Inbox + LinkedRecordsUI]
  convoLinks --> inboxUi
```

Operational interpretation:

1. A runtime interaction happens (for example, webchat turn, missed call, qualification, booking).
2. The system emits a typed platform event (`ConversationStarted`, `ConversationQualified`, `BookingConfirmed`, etc.).
3. `/api/platform/events` authenticates the request using `x-platform-shared-secret`.
4. Processor validates and records event state.
5. Integration rules derive CRM commands (create/update lead, link conversation, callback task, appointment updates, etc.).
6. Command executor performs tenant-scoped CRM writes.
7. Inbox and related surfaces show updated linkage and review status.

---

## 4) API Surface and Responsibilities

### 4.1 Platform APIs (`src/app/api/platform`)

- `events/route.ts`: secure event ingestion; validates envelope; executes processor.
- `outbox/publish/route.ts`: retries/publishes queued outbound events.
- `relink/search/route.ts`: manual relink search over customer/job candidates.
- `conversations/[conversationId]/relink/route.ts`: patch conversation linkage to customer/job and propagate to dependent CRM records.
- `conversations/[conversationId]/review/route.ts`: update review ownership/status metadata.

### 4.2 Front Desk / AI Hub APIs (`src/app/api/crm`)

- `channel-test/runtime/route.ts`: runtime readiness snapshot for live channel tester.
- `channel-test/webchat/sessions/route.ts`: open linked webchat runtime session.
- `channel-test/webchat/messages/route.ts`: append webchat message into linked runtime.
- `ai-hub/live/sessions/*`: internal live front-desk test session lifecycle and message processing.

### 4.3 Existing CRM Domain APIs

CRM domain routes (`customers`, `jobs`, `quotes`, `invoices`, `settings`, etc.) remain source-of-truth for business workflows, with platform commands writing into those same domain entities.

---

## 5) Event and Command Contract Model

Defined in `src/modules/platform/contracts.ts`.

### 5.1 Event Model

Events are versioned envelopes with:

- `event_id`, `event_type`, `event_version`
- `workspace_id`, `occurred_at`
- `source_system`
- idempotency/correlation/causation fields
- `aggregate` metadata and arbitrary `payload`

Supported event types include:

- `MissedCallCaptured`
- `ConversationStarted`
- `ConversationRestarted`
- `ConversationQualified`
- `BookingRequested`
- `BookingConfirmed`
- `EscalationRaised`
- and additional CRM-signal events such as `QuoteAccepted`, `InvoiceOverdue`, `WorkspaceSettingsChanged`

### 5.2 Command Model

Commands are versioned envelopes with:

- `command_id`, `command_type`, `command_version`
- `workspace_id`, `issued_at`
- `source_system`, `target_system`
- idempotency/correlation/causation fields
- `aggregate` metadata and `payload`

Supported command types include:

- `CreateOrUpdateLeadFromConversation`
- `MatchCustomerByChannelIdentity`
- `CreateCallbackTask`
- `CreateOrUpdateAppointment`
- `CreateEscalationTask`
- `LinkConversationToCustomerOrJob`

---

## 6) Conversation Linking and Review Workflow

Conversation linkage is stored in platform link tables and surfaced in the Inbox.

### 6.1 Automatic Linking

During event processing, commands may auto-link:

- conversation -> customer
- conversation -> job
- conversation -> lead/appointment references

### 6.2 Manual Relink

Operators can:

1. Search customer/job candidates using `GET /api/platform/relink/search`.
2. Save linkage via `PATCH /api/platform/conversations/[conversationId]/relink`.

Relink behavior includes propagation:

- lead `customer_id` updates
- callback/booking appointment customer/job updates
- cross-customer mismatch validation on selected jobs

### 6.3 Review Queue

Unresolved or ambiguous linkage states are flagged as review-needed.
Operators update ownership/status via:

- `PATCH /api/platform/conversations/[conversationId]/review`

---

## 7) Live Channel Tester (Agentic Front Desk)

UI component: `src/modules/crm/components/ai-hub/LiveFrontDeskTester.tsx`  
Page: `src/app/(crm)/ai-hub/live/page.tsx`

Capabilities:

- displays linked runtime metadata and readiness per channel (webchat, sms, whatsapp, voice)
- opens linked webchat sessions
- sends webchat turns and displays runtime/agent responses
- periodically refreshes runtime snapshot
- shows recent CRM-linked records with deep links into Inbox/Customer/Job/Calendar

Access:

- role/tenant gated through CRM auth and AI Hub live access checks

---

## 8) Persistence Model (Supabase / SQL Migrations)

Platform and runtime linkage are introduced through dedicated migrations:

- `supabase/migrations/202603300001_crm_platform_core.sql`
  - workspace aliases
  - event log
  - command log
  - indexes, triggers, RLS policies

- `supabase/migrations/202603300002_crm_platform_conversation_links.sql`
  - conversation link table for CRM materialization

- `supabase/migrations/202603300003_crm_platform_outbox.sql`
  - durable outbox with retry/publication metadata

- `supabase/migrations/202604070001_crm_customerjourneys_runtime_links.sql`
  - CRM tenant <-> CustomerJourneys runtime links and readiness references

Design note: data is tenant/workspace scoped, with RLS intended to enforce isolation and role-based write constraints.

---

## 9) Security and Access Control

### 9.1 API Auth

CRM APIs use shared auth helpers:

- `requireCrmApiUser(...)` for authenticated role-gated actions
- manager/admin-only routes for sensitive operations

### 9.2 Platform Ingestion Security

`POST /api/platform/events` requires `x-platform-shared-secret` that must match `PLATFORM_SHARED_SECRET`.

### 9.3 Tenant and Role Rules

Different actions are constrained by role sets (`management`, `admin`, `sales`, `accounts` etc.) and tenant membership/session context.
Live tester access is further constrained by runtime/tenant policy checks.

---

## 10) Configuration and Runtime Dependencies

Configuration is centralized in `src/modules/crm/lib/env.ts`.

### 10.1 Required Core CRM Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 10.2 Required Admin/Processor Variables

- `SUPABASE_SERVICE_ROLE_KEY`

### 10.3 Platform Bridge

- `PLATFORM_SHARED_SECRET`
- `AGENTIC_PLATFORM_EVENT_WEBHOOK_URL` (for outbound publishing)

### 10.4 Live Agent Path

- `AGENTIC_LIVE_AGENT_URL`
- `AGENTIC_LIVE_AGENT_TOKEN`
- `AGENTIC_LIVE_AGENT_TIMEOUT_MS` (default 15000)

### 10.5 CustomerJourneys Bridge

- `CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL`
- `CUSTOMERJOURNEYS_ADMIN_API_TOKEN`
- `CUSTOMERJOURNEYS_INTERNAL_API_TOKEN`

### 10.7 Live Runtime Event Bridge

When using the live CustomerJourneys runtime with the local CRM, the runtime must have:

- `CRM_PLATFORM_EVENTS_URL`
- `CRM_PLATFORM_SHARED_SECRET`

In the current validated setup, the runtime publishes back into the local CRM through a live Cloudflare tunnel that targets:

- `POST /api/platform/events`

### 10.6 E2E Fixture Mode

- `CRM_E2E_PLATFORM_FIXTURES=1` for deterministic local/test behavior.

---

## 11) Testing Strategy and What Is Already Verified

### 11.1 CRM/Platform Unit + Integration (`tests/crm`)

- contract validity and vocabulary checks
- event-to-command derivation behavior
- processor outcomes (processed/deferred/failure paths)
- platform event route auth and payload handling
- live-agent adapter behavior
- CRM route validations and role guards
- relink/review route behavior and constraints

### 11.2 End-to-End (`tests/e2e`)

- `front-desk-live.spec.ts`: live channel tester readiness and webchat booking journey
- `front-desk-smoke.spec.ts`: inbox rendering, review ownership interactions, manual relink UX/API payloads

### 11.3 Live Production Smoke Status

Verified against the live runtime on April 11, 2026:

- strict early-`yes` gating: a bare `yes` after a slot offer does not confirm prematurely
- broad-window slot search: inputs like `at some stage tomorrow am` return concrete slots
- full strict booking flow: all mandatory fields are collected before confirmation
- CRM materialization: confirmed conversations write `ConversationStarted`, `ConversationQualified`, `BookingConfirmed`, command logs, conversation links, and appointments into CRM

Reference live proof:

- runtime revision: `customerjourneys-platform-api-00312-l48`
- confirmed conversation: `467de906-7817-467b-86db-0f4c6eb70134`
- confirmed booking: `e6cae42e-4300-4001-aeab-c70f0cdf65b8`

---

## 12) Operating Model for Teams

Use this mental model when explaining to stakeholders:

1. **CRM is the system of record** for customers/jobs/appointments/quotes/invoices.
2. **Agentic runtime produces structured events** about conversation outcomes.
3. **Platform processor converts events into deterministic CRM commands**.
4. **Links and timelines provide auditability** and manual correction capabilities.
5. **Outbox guarantees outbound delivery attempts** for CRM-origin integrations.

This makes the platform both automation-friendly and operator-safe:

- automation handles the happy path
- review + relink workflows handle ambiguity
- logs/timelines keep behavior explainable and supportable

---

## 13) Troubleshooting Cheat Sheet

### Symptom: Runtime is healthy but AI responses fallback

Likely causes:

- managed live-agent URL/token missing or invalid
- provider unavailable upstream
- environment mismatch between deployed app and provider config

Check:

1. `/health` of deployed service
2. live-agent env vars in the deployed environment
3. provider auth/availability and tenant policy for managed path
4. event/command logs for fallback reasons and processing status

### Symptom: Events accepted but CRM not updated

Check:

1. workspace alias exists for the workspace id
2. processor status in event/command logs
3. command execution errors in processor flow
4. Supabase service role and RLS policy behavior

### Symptom: Conversation appears in review queue unexpectedly

Check:

1. customer/job link confidence and matching ambiguity
2. manual relink history metadata
3. review ownership/status metadata

---

## 14) Suggested Stakeholder Explainer (Short Script)

"Our CRM and Agentic AI system works like an event-driven operations layer. Conversations from channels like webchat and phone generate structured events. Those events are validated and turned into safe, deterministic CRM commands, which update leads, appointments, and customer/job links. If automation is uncertain, the system pushes cases into a review queue where operators can take ownership and manually relink records. We keep full logs and timelines for auditability, and we use role-based security plus shared-secret ingestion to keep the integration safe in production."
