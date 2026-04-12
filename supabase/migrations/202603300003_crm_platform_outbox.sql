create table if not exists crm.platform_outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspace_aliases(workspace_id) on delete cascade,
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'MissedCallCaptured',
      'ConversationStarted',
      'ConversationQualified',
      'BookingRequested',
      'BookingConfirmed',
      'AutomationDispatched',
      'EscalationRaised',
      'DeliveryStatusUpdated',
      'CustomerUpdated',
      'JobCreated',
      'JobRescheduled',
      'QuoteAccepted',
      'InvoiceOverdue',
      'WorkspaceSettingsChanged'
    )
  ),
  event_version integer not null default 1 check (event_version > 0),
  source_system text not null check (source_system in ('agentic_runtime', 'crm')),
  idempotency_key text not null,
  correlation_id uuid,
  causation_id uuid,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  publication_status text not null default 'pending' check (publication_status in ('pending', 'published', 'failed')),
  occurred_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz,
  delivery_attempt_count integer not null default 0 check (delivery_attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, source_system, idempotency_key)
);

create trigger crm_platform_outbox_events_set_updated_at
before update on crm.platform_outbox_events
for each row execute procedure crm.set_updated_at();

create index if not exists crm_platform_outbox_events_tenant_status_occurred_idx
  on crm.platform_outbox_events (tenant_id, publication_status, occurred_at desc);

create index if not exists crm_platform_outbox_events_workspace_type_occurred_idx
  on crm.platform_outbox_events (workspace_id, event_type, occurred_at desc);

alter table crm.platform_outbox_events enable row level security;

create policy "crm_read_platform_outbox_events" on crm.platform_outbox_events
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_platform_outbox_events" on crm.platform_outbox_events
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_platform_outbox_events" on crm.platform_outbox_events
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_platform_outbox_events" on crm.platform_outbox_events
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
