alter table crm.platform_event_log
  drop constraint if exists platform_event_log_processing_status_check;

alter table crm.platform_event_log
  add constraint platform_event_log_processing_status_check
  check (processing_status in ('accepted', 'processed', 'failed', 'ignored', 'dead_letter'));

alter table crm.platform_event_log
  add column if not exists dead_letter_reason text;

alter table crm.platform_outbox_events
  drop constraint if exists platform_outbox_events_publication_status_check;

alter table crm.platform_outbox_events
  add constraint platform_outbox_events_publication_status_check
  check (publication_status in ('pending', 'published', 'failed', 'dead_letter'));

alter table crm.platform_outbox_events
  add column if not exists dead_letter_reason text;

create index if not exists crm_platform_event_log_tenant_status_occurred_idx
  on crm.platform_event_log (tenant_id, processing_status, occurred_at desc);
