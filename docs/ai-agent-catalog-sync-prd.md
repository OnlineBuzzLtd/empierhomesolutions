# PRD — AI Agent Catalogue Sync

**Created**: 2026-05-30  
**Status legend**: 🔴 not started · 🟡 in progress · 🟢 done · ⚪ blocked  
**Severity**: `P0` customer-facing correctness · `P1` important within ~2 weeks · `P2` hardening

## Summary

Empire CRM now owns the tenant-scoped, customer-safe AI catalogue contract used by the AI Receptionist across WhatsApp, SMS, web chat, and phone calls. The catalogue projects Supabase services, job types, packages, pricing policy, booking durations, and safety wording into one signed read-only API:

`GET /api/platform/catalog`

CustomerJourneys and the ElevenLabs voice path must consume this endpoint instead of relying on copied service names, hardcoded prices, or channel-specific prompt text.

## Public Contract

The API returns:

- tenant id, slug, name, trade vertical, timezone, GBP currency, VAT mode
- active AI-visible services and job types
- active AI-visible packages
- public display prices only when AI pricing is enabled
- default and emergency booking durations
- price policy and fallback wording
- safety/escalation wording
- catalogue version and generation timestamp
- channel coverage declaration for WhatsApp, SMS, web chat, and voice

The API never returns:

- unit cost
- markup
- margin
- profit
- supplier terms
- raw quote templates
- internal diagnostics
- runtime control-plane labels

## Tickets

### 🟢 AICAT-001 — AI-Safe Catalogue Builder

**Severity**: P0 · **Effort**: M · **Depends on**: none

Builds a tenant-scoped catalogue projection from CRM data. Filters inactive or hidden records, exposes only customer-safe fields, and calculates package display prices from sell prices only.

Acceptance:

- no cross-tenant leakage
- no cost/margin/markup/profit/supplier fields in output
- inactive or AI-hidden rows are excluded
- empty tenants return a valid empty catalogue

### 🟢 AICAT-002 — Signed Platform Catalogue API

**Severity**: P0 · **Effort**: S · **Depends on**: AICAT-001

Adds `GET /api/platform/catalog`, authenticated with the existing platform HMAC signature. Tenant can be resolved from CRM tenant id, workspace id, or CustomerJourneys tenant id.

Acceptance:

- invalid auth is rejected
- unknown tenant returns 404
- valid request returns the requested tenant catalogue only
- response is `no-store` for v1

### 🟢 AICAT-003 — Catalogue Versioning

**Severity**: P1 · **Effort**: S · **Depends on**: AICAT-001

Adds a deterministic tenant-specific catalogue version so runtimes can detect stale knowledge. Relevant service, job type, package, package item, product, and tenant setting changes affect the version.

Acceptance:

- same data produces same version
- relevant tenant edits change version
- another tenant's edits do not affect this tenant's version

### 🟢 AICAT-004 — Multi-Channel Runtime Consumption

**Severity**: P0 · **Effort**: L · **Depends on**: AICAT-002

CustomerJourneys now fetches the Empire CRM catalogue through the signed platform endpoint and projects it into the shared tenant context/pricing lookup used by WhatsApp, SMS, web chat, and ElevenLabs voice tool paths.

Acceptance:

- all channels use the same service/pricing/booking policy
- catalogue failure produces safe fallback copy
- no channel invents prices
- booking/conversation metadata includes catalogue version where available

Implementation notes:

- text/web chat/WhatsApp use catalogue-backed `tenantContext` and pricing tools
- ElevenLabs managed voice uses the same context and pricing tools through platform-api
- code is ready for rollout; live ElevenLabs agents must be re-provisioned after deploy so the updated prompt/tool schema is active

### 🟢 AICAT-005 — Trade-Vertical Defaults

**Severity**: P1 · **Effort**: M · **Depends on**: AICAT-001

Adds trade vertical support for plumbing, heating, electrical, drainage, roofing, cleaning, pest control, locksmith, and general trades. New tenants can be seeded with starter services/job types and cautious pricing defaults.

Acceptance:

- unknown vertical falls back to general trades
- non-plumbing tenants do not receive plumbing-only safety wording
- seeded services are tenant-scoped and editable

### 🟢 AICAT-006 — AI Visibility And Pricing Controls

**Severity**: P1 · **Effort**: M · **Depends on**: AICAT-001

Adds AI visibility, bookability, price permission, office-quote requirement, duration, and disclaimer controls for services, job types, packages, and tenant catalogue policy.

Acceptance:

- admins can hide CRM catalogue records from AI
- admins can allow booking without price quoting
- packages only expose display price when AI pricing is enabled
- existing tenants default to cautious pricing

### 🟢 AICAT-007 — Admin AI Catalogue Settings UX

**Severity**: P1 · **Effort**: M · **Depends on**: AICAT-001

Adds an AI catalogue card and preview to Settings. Admins can see the AI-safe catalogue version, visible service/package counts, channel status, and sample service rows.

Acceptance:

- preview excludes restricted pricing fields
- channel coverage shows WhatsApp, SMS, web chat, and phone
- empty state explains what to configure next

### 🟢 AICAT-008 — Channel Diagnostics

**Severity**: P1 · **Effort**: S · **Depends on**: AICAT-007

Settings now shows business-level channel readiness using the tenant runtime link. Raw runtime details remain outside the main preview.

Acceptance:

- connected channels are visible
- channels needing setup are visible
- copy uses business language

### 🟡 AICAT-009 — Remove Hardcoded Runtime Pricing

**Severity**: P0 · **Effort**: M · **Depends on**: AICAT-004

CustomerJourneys runtime prompts and ElevenLabs managed-agent setup now instruct the agent to use the live catalogue and `get_pricing` tools instead of setup-time prices. If the catalogue is unavailable, fallback responses defer exact pricing to the office.

Acceptance:

- prompt/config grep finds no old Empire prices
- all customer-facing exact prices come from the catalogue
- disabled pricing policy falls back to office-confirmation wording

Remaining rollout:

- re-provision the live ElevenLabs managed agent after deploy
- run live multi-channel price-answer probes against WhatsApp, SMS, web chat, and phone

### 🟡 AICAT-010 — Multi-Channel Event Metadata

**Severity**: P1 · **Effort**: M · **Depends on**: AICAT-004

Booking events now carry safe catalogue metadata: version, pricing policy, quoted package id, quoted amount, and whether office confirmation is required. Conversation-level display/audit UX remains a follow-up.

Acceptance:

- office can audit which catalogue version each channel used
- no internal cost/margin fields are logged
- metadata displays safely in AI Receptionist

### 🟢 AICAT-011 — Tenant Provisioning Defaults

**Severity**: P1 · **Effort**: M · **Depends on**: AICAT-005

New tenants can be created with starter trade services and job types without cloning Empire pricing.

Acceptance:

- selected vertical seeds relevant service/job type defaults
- new tenants do not inherit Empire-specific prices by default
- seeded data remains tenant-scoped and editable

### 🟡 AICAT-012 — End-To-End Multi-Channel Validation

**Severity**: P0 · **Effort**: L · **Depends on**: AICAT-004

Validate catalogue-backed answers over WhatsApp, SMS, web chat, and phone call scenarios for multiple trade verticals.

Acceptance:

- same tenant/service produces consistent pricing policy across all channels
- no cross-tenant catalogue leakage
- no channel quotes prices when catalogue policy forbids it

## Runtime Integration Notes

CustomerJourneys should call:

```http
GET /api/platform/catalog?customerJourneysTenantId=<runtimeTenantId>
x-platform-timestamp: <unix seconds>
x-platform-signature: sha256=<hmac>
```

The signature payload for GET uses an empty body, matching the existing calendar resource endpoints.

Runtime fallback rule:

> If the catalogue cannot be fetched, qualify the customer and defer exact pricing to the office. Do not invent prices.

## Test Coverage

Current Empire-side coverage:

- unit tests for catalogue projection
- cost/margin/supplier/markup redaction test
- package display price test
- version stability/change test
- vertical fallback test

Required cross-repo coverage:

- WhatsApp catalogue pricing scenario
- SMS catalogue pricing scenario
- web chat catalogue pricing scenario
- ElevenLabs voice catalogue pricing scenario
- catalogue unavailable fallback for every channel
- prompt/config grep for removed hardcoded pricing

## Assumptions

- Empire CRM/Supabase is the source of truth for services, packages, pricing policy, and booking durations.
- CustomerJourneys remains the orchestration layer for SMS, WhatsApp, and web chat.
- ElevenLabs remains the managed voice layer for phone calls.
- The first release uses read-through `no-store` catalogue access; runtime caching can be added after the contract is stable.
- Pricing remains cautious by default for new tenants.
