create table if not exists crm.platform_conversation_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspace_aliases(workspace_id) on delete cascade,
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  conversation_id uuid not null,
  customer_id uuid references crm.customers(id) on delete set null,
  lead_id uuid references crm.leads(id) on delete set null,
  job_id uuid references crm.jobs(id) on delete set null,
  callback_appointment_id uuid references crm.appointments(id) on delete set null,
  booking_appointment_id uuid references crm.appointments(id) on delete set null,
  latest_channel text,
  identity_phone text,
  identity_email text,
  metadata jsonb not null default '{}'::jsonb,
  latest_event_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, conversation_id)
);

create trigger crm_platform_conversation_links_set_updated_at
before update on crm.platform_conversation_links
for each row execute procedure crm.set_updated_at();

create index if not exists crm_platform_conversation_links_tenant_conversation_idx
  on crm.platform_conversation_links (tenant_id, conversation_id);

alter table crm.platform_conversation_links enable row level security;

create policy "crm_read_platform_conversation_links" on crm.platform_conversation_links
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_platform_conversation_links" on crm.platform_conversation_links
for insert to authenticated
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_platform_conversation_links" on crm.platform_conversation_links
for update to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_delete_platform_conversation_links" on crm.platform_conversation_links
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
