create table if not exists crm.workspace_aliases (
  workspace_id uuid primary key,
  tenant_id uuid not null unique references crm.tenants(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_workspace_aliases_set_updated_at
before update on crm.workspace_aliases
for each row execute procedure crm.set_updated_at();

insert into crm.workspace_aliases (workspace_id, tenant_id)
select id, id
from crm.tenants
on conflict (tenant_id) do nothing;

create or replace function crm.current_user_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public, crm
as $$
  select workspace_id
  from crm.workspace_aliases
  where tenant_id = crm.current_user_tenant_id()
  limit 1;
$$;

create table if not exists crm.platform_event_log (
  event_id uuid primary key,
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
  processing_status text not null default 'accepted' check (processing_status in ('accepted', 'processed', 'failed', 'ignored')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, source_system, idempotency_key)
);

create table if not exists crm.platform_command_log (
  command_id uuid primary key,
  workspace_id uuid not null references crm.workspace_aliases(workspace_id) on delete cascade,
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  command_type text not null check (
    command_type in (
      'CreateOrUpdateLeadFromConversation',
      'MatchCustomerByChannelIdentity',
      'CreateCallbackTask',
      'CreateOrUpdateAppointment',
      'CreateEscalationTask',
      'LinkConversationToCustomerOrJob'
    )
  ),
  command_version integer not null default 1 check (command_version > 0),
  source_system text not null check (source_system in ('agentic_runtime', 'crm')),
  target_system text not null check (target_system in ('agentic_runtime', 'crm')),
  idempotency_key text not null,
  correlation_id uuid,
  causation_id uuid,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'acked', 'failed', 'dead_letter')),
  requested_by_user_id uuid,
  issued_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  last_error text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, target_system, idempotency_key)
);

create trigger crm_platform_event_log_set_updated_at
before update on crm.platform_event_log
for each row execute procedure crm.set_updated_at();

create trigger crm_platform_command_log_set_updated_at
before update on crm.platform_command_log
for each row execute procedure crm.set_updated_at();

create index if not exists crm_platform_event_log_tenant_occurred_idx
  on crm.platform_event_log (tenant_id, occurred_at desc);
create index if not exists crm_platform_event_log_tenant_type_idx
  on crm.platform_event_log (tenant_id, event_type, occurred_at desc);
create index if not exists crm_platform_command_log_tenant_issued_idx
  on crm.platform_command_log (tenant_id, issued_at desc);
create index if not exists crm_platform_command_log_tenant_status_idx
  on crm.platform_command_log (tenant_id, delivery_status, issued_at desc);

alter table crm.workspace_aliases enable row level security;
alter table crm.platform_event_log enable row level security;
alter table crm.platform_command_log enable row level security;

create policy "crm_read_workspace_aliases" on crm.workspace_aliases
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_workspace_aliases" on crm.workspace_aliases
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_platform_event_log" on crm.platform_event_log
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_platform_event_log" on crm.platform_event_log
for insert to authenticated
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_platform_event_log" on crm.platform_event_log
for update to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_delete_platform_event_log" on crm.platform_event_log
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_platform_command_log" on crm.platform_command_log
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_platform_command_log" on crm.platform_command_log
for insert to authenticated
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_platform_command_log" on crm.platform_command_log
for update to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_delete_platform_command_log" on crm.platform_command_log
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
