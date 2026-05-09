-- 2026-05-09: extend crm.platform_event_log.event_type check constraint to
-- include 'BookingCompleted'. Fired by the platform-api auto-close worker
-- when a confirmed booking's end_time has passed (Phase 2 of
-- close-past-bookings PRD on the CJ side). Without this, Empire's
-- event-log insert would 23514 on the new event type.
--
-- Already applied to the live DB on 2026-05-09 alongside the CJ deploy;
-- this migration codifies it for fresh environments.

alter table crm.platform_event_log
  drop constraint if exists platform_event_log_event_type_check;

alter table crm.platform_event_log
  add constraint platform_event_log_event_type_check
  check (event_type = ANY (ARRAY[
    'MissedCallCaptured'::text,
    'ConversationStarted'::text,
    'ConversationQualified'::text,
    'BookingRequested'::text,
    'BookingConfirmed'::text,
    'BookingCompleted'::text,
    'AutomationDispatched'::text,
    'EscalationRaised'::text,
    'DeliveryStatusUpdated'::text,
    'CustomerUpdated'::text,
    'JobCreated'::text,
    'JobRescheduled'::text,
    'QuoteAccepted'::text,
    'InvoiceOverdue'::text,
    'WorkspaceSettingsChanged'::text
  ]));
