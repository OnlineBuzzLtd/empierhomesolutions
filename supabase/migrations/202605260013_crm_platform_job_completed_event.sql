alter table crm.platform_event_log
  drop constraint if exists platform_event_log_event_type_check;

alter table crm.platform_event_log
  add constraint platform_event_log_event_type_check
  check (event_type = ANY (ARRAY[
    'MissedCallCaptured'::text,
    'ConversationStarted'::text,
    'ConversationRestarted'::text,
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
    'JobCompleted'::text,
    'QuoteAccepted'::text,
    'InvoiceOverdue'::text,
    'WorkspaceSettingsChanged'::text,
    'booking.held'::text,
    'booking.confirmed'::text,
    'booking.cancelled'::text,
    'booking.rescheduled'::text,
    'lead.upserted'::text,
    'resource.availability_changed'::text
  ]));

alter table crm.platform_outbox_events
  drop constraint if exists platform_outbox_events_event_type_check;

alter table crm.platform_outbox_events
  add constraint platform_outbox_events_event_type_check
  check (event_type = ANY (ARRAY[
    'MissedCallCaptured'::text,
    'ConversationStarted'::text,
    'ConversationRestarted'::text,
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
    'JobCompleted'::text,
    'QuoteAccepted'::text,
    'InvoiceOverdue'::text,
    'WorkspaceSettingsChanged'::text,
    'booking.held'::text,
    'booking.confirmed'::text,
    'booking.cancelled'::text,
    'booking.rescheduled'::text,
    'lead.upserted'::text,
    'resource.availability_changed'::text
  ]));
