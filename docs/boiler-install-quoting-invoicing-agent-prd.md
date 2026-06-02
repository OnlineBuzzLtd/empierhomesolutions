# PRD - Boiler install quoting + invoicing agent flow

**Created**: 2026-06-01  
**Status legend**: Red not started · Yellow in progress · Green done  
**Principle**: keep the CRM diary-first workflow. The AI still gets the booking into the diary; quote and invoice automation starts from that booked job.

## Context

Boiler installs and powerflush work usually need a survey before a fixed price can be issued. The CRM already supports leads, booked jobs, survey appointments, quote versions, quote acceptances, invoice schedules, payment links, checklists, and certificates. This PRD upgrades those existing surfaces instead of adding a parallel pipeline.

## Invariants

- A survey is a normal CRM booking classified as `survey_assessment`.
- Install/powerflush AI paths must not hardcode prices or bypass `ai_requires_office_quote`.
- Quote math remains in the existing quote/invoice helpers.
- Deposit/pro-forma invoices must not block final balance invoices.
- Compliance closeout is tracked with evidence; the agent cannot self-certify Gas Safe or Building Regulations completion.

## Tickets

### BIQA-001 - Survey booking classification

Add `visit_classification` and `commercial_stage` to jobs, plus `visit_classification` to appointments.

Acceptance:
- install/powerflush bookings can appear in the diary as survey visits.
- current booked-job flow remains intact.
- lead status can stay `survey_booked` for survey-first work.

### BIQA-002 - AI survey-first booking policy

Project a catalogue booking rule that tells AI runtimes install/powerflush work should be survey-first, while still creating diary records.

Acceptance:
- AI-safe catalogue exposes `survey_first_for_installations_and_powerflush`.
- platform booking materialisation classifies install/powerflush bookings as survey appointments.

### BIQA-003 - Survey assessment capture

Add `crm.job_survey_assessments` for boiler type, model, flue, gas pipe, condensate, water pressure, radiators, controls, access, parts, risks, and engineer notes.

Acceptance:
- survey details are tenant-scoped and job-linked.
- survey completion can later drive quote readiness.

### BIQA-004 - Install quote scope and terms

Extend quotes and quote versions with structured `install_scope`, `payment_terms`, and `agent_autonomy`.

Acceptance:
- quote builder captures boiler model, scope, warranty, exclusions, deposit terms, and balance terms.
- quote page and PDF display the install scope.
- quote versions preserve the structured fields.

### BIQA-005 - Acceptance evidence

Extend quote acceptances with acceptance channel and evidence URL/attachment reference.

Acceptance:
- accepted quotes record method, channel, accepted person, email, notes, and evidence.
- existing `QuoteAccepted` platform event behavior is preserved.

### BIQA-006 - Deposit/pro-forma invoice stages

Extend invoices with `invoice_kind`, `invoice_schedule_id`, and `balance_of_quote_id`.

Acceptance:
- invoice schedules generate deposit/stage/final invoice kinds.
- payment links continue to use existing invoice payment flow.
- deposit/pro-forma invoices do not count as final invoices.

### BIQA-007 - Cooling-off consent

Add `crm.job_cooling_off_consents` for off-premises/distance sale status, expiry, early-start consent, method, evidence, and notes.

Acceptance:
- jobs can track 14-day cooling-off risk.
- future install-start automation can block or warn without schema changes.

### BIQA-008 - Install prep

Use current job notes/checklists plus commercial stage to track access, parking, shutoff, materials, and old tank/cylinder removal.

Acceptance:
- job stage can move to `install_ready` only after prep is done by office/agent rules.

### BIQA-009 - Final balance invoice

Change completed-job auto-invoicing so it skips only existing standard/final invoices, not deposit/stage invoices.

Acceptance:
- paid deposit/stage invoice totals are deducted from the final balance.
- final balance invoices use `invoice_kind = final`.
- zero-balance final invoices are skipped.

### BIQA-010 - Compliance closeout

Add `crm.job_compliance_closeouts` for commissioning, controls handover, Building Regulations notification due/complete, Gas Safe reference, certificate received/sent, and evidence.

Acceptance:
- compliance closeout is tenant-scoped and job-linked.
- certificate evidence remains human/system-provided.

### BIQA-011 - Agent autonomy guardrails

Agent can autonomously book survey, draft quote, record acceptance, generate deposit invoice, chase payment, prepare final invoice, and chase closeout only when required inputs exist.

Acceptance:
- missing survey fields, cooling-off consent, or compliance evidence escalates to admin review.
- no customer-facing fixed install price is sent unless catalogue/business rules allow it.

### BIQA-012 - CRM UI upgrades

Expose commercial stage, visit classification, invoice kind, acceptance evidence, install scope, and payment terms in existing job/quote/invoice screens.

Acceptance:
- plumber diary stays simple.
- office/admin sees the commercial state of install work without leaving job/quote/invoice pages.

## Test Plan

- Payment plan math reconciles deposit/stage/final to quote totals after VAT.
- Invoice schedule generation writes the correct invoice kind and schedule link.
- Completed jobs with paid deposit invoices still generate final balance invoices.
- Quote acceptance evidence persists and `QuoteAccepted` still emits.
- AI catalogue exposes the survey-first booking rule.
- Booking command creates survey appointments for install/powerflush classifications.
- Engineers remain blocked from manager/accounts quote/invoice actions by existing role checks.

## Rollback

All database changes are additive. Rollback for UI/API behavior is code revert. Existing records remain readable because defaults are backward-compatible.

## AQD - Live CRM detail drawer + AI quote drafting automation

**Created**: 2026-06-01  
**Principle**: the demo and live CRM use the same quote drafting service. The demo makes the workflow visible; it does not fake a separate quote path.

### Invariants

- The AI remains diary-first: it books the job/survey before commercial automation starts.
- AI quote drafting is tenant-flagged and defaults off for live tenants.
- V1 creates draft quotes only; customer send/acceptance remains an authorised office action.
- Prices come from tenant catalogue packages/templates. The agent never invents line items or prices.
- Survey-required work can only quote after the survey assessment is completed.
- No live SMS, voice, WhatsApp, Stripe, or payment-provider tests are part of this rollout.

### AQD-001 - Tenant quote drafting flag

Add `ai_quote_drafting_enabled` and `ai_quote_drafting_mode` to tenant settings.

Acceptance:
- existing tenants remain unchanged with drafting off.
- managers/admins can configure the mode in workspace settings.
- server helpers can read the mode without loose JSON lookups.

### AQD-002 - Shared quote automation service

Add a central quote automation module that accepts tenant, job, actor, and trigger source.

Acceptance:
- booking, survey, manual, and demo triggers call the same module.
- module returns `created`, `skipped`, or `blocked` with blocker codes.
- draft quotes use existing quote rollup, quote version, package expansion, and payment schedule helpers.
- repeated triggers do not duplicate quotes.

### AQD-003 - Survey completion trigger

When a survey assessment is saved as completed, run quote drafting as a post-save side effect.

Acceptance:
- survey save succeeds even if quote drafting blocks.
- result is returned in the API response.
- engineer survey completion does not grant quote send/accept/invoice permissions.

### AQD-004 - Booking trigger for fixed-price services

After lead confirm-booking or platform booking materialisation creates a job, run quote drafting for non-survey bookings where tenant/package rules allow.

Acceptance:
- fixed-price service bookings can create a draft quote.
- survey bookings block until survey completion.
- office-quote-required packages do not quote from booking alone.

### AQD-005 - Manual job action

Add an authorised job action to run the same quote drafting module manually.

Acceptance:
- manager/admin/sales/accounts users can request a draft from the job page.
- existing quote returns a link/result instead of creating duplicates.
- blockers show the missing reason.

### AQD-006 - Demo commercial feed and drawer

Expand `/demo/run` Live CRM with commercial events and a right-side detail drawer.

Acceptance:
- rows for customers, leads, jobs, appointments, survey assessments, quotes, quote acceptances, invoice schedules, invoices, and payments are expandable.
- drawer shows overview, linked trail, commercial timeline, and raw CRM fields.
- no platform provider payloads or secrets are exposed.

### AQD-007 - Demo operator quote story

Add operator actions to mark a survey done, draft a quote, and generate a deposit invoice.

Acceptance:
- demo actions use the shared quote automation service.
- generated quote/invoice records appear in Live CRM.
- no customer notification, live payment, or provider call is sent by these demo actions.

### AQD-008 - Demo cleanup for commercial records

Add explicit `is_test` support to commercial tables used by the demo and extend cleanup order.

Acceptance:
- ending a demo removes the commercial trail created in the session.
- cleanup remains tenant-scoped and test-flag-scoped.
- cleanup contract test proves every listed table has an `is_test` migration.

### AQD Test Plan

- Unit: quote automation package selection, trigger flagging, survey blocker, idempotency, fallback payment plan.
- API: survey completion trigger, lead confirm-booking trigger, manual job draft route, demo live-record route, demo quote action route.
- Unit: realtime feed reducer/update/de-dupe and commercial timeline derivation.
- Contract: realtime migration table list and demo cleanup table/is_test list.
- Regression: payment plan math, invoice schedule generation, quote acceptance event payload, existing booking creates job + appointment.
- Final checks: `npm run lint`, `npm run typecheck`, targeted Vitest, and `npm run build` where feasible.

### AQD Rollback

Turn `ai_quote_drafting_enabled` off for the tenant to stop live automation. Code revert removes route/UI callers. Additive schema can remain because defaults preserve existing behaviour.
