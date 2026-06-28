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
    'CustomerPromiseChanged'::text,
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
    'CustomerPromiseChanged'::text,
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

create table if not exists crm.customer_promise_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade default crm.current_user_tenant_id(),
  promise_id uuid not null references crm.customer_promises(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'updated', 'completed', 'cancelled', 'reopened')),
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'office' check (source in ('office', 'ai', 'system')),
  previous_status text,
  next_status text,
  previous_due_at timestamptz,
  next_due_at timestamptz,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_customer_promise_events_tenant_created_idx
  on crm.customer_promise_events (tenant_id, created_at desc);

create index if not exists crm_customer_promise_events_promise_created_idx
  on crm.customer_promise_events (promise_id, created_at desc);

alter table crm.customer_promise_events enable row level security;

drop policy if exists "crm_read_customer_promise_events" on crm.customer_promise_events;
drop policy if exists "crm_insert_customer_promise_events" on crm.customer_promise_events;
drop policy if exists "crm_delete_customer_promise_events" on crm.customer_promise_events;

create policy "crm_read_customer_promise_events" on crm.customer_promise_events
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_customer_promise_events" on crm.customer_promise_events
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_customer_promise_events" on crm.customer_promise_events
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

notify pgrst, 'reload schema';
