create table if not exists crm.customerjourneys_runtime_links (
  crm_tenant_id uuid primary key references crm.tenants(id) on delete cascade,
  customerjourneys_tenant_id uuid unique,
  platform_api_base_url text,
  auth_mode text not null default 'internal_service' check (auth_mode in ('internal_service', 'admin_bearer')),
  webchat_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  voice_enabled boolean not null default false,
  display_sms_number text,
  display_whatsapp_number text,
  display_voice_number text,
  last_readiness_check jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_customerjourneys_runtime_links_set_updated_at
before update on crm.customerjourneys_runtime_links
for each row execute procedure crm.set_updated_at();

insert into crm.customerjourneys_runtime_links (
  crm_tenant_id,
  customerjourneys_tenant_id,
  auth_mode
)
values (
  '11111111-1111-4111-8111-111111111111',
  '75d76e43-4e5e-4568-8ff2-e2594c9818f9',
  'internal_service'
)
on conflict (crm_tenant_id) do update
set customerjourneys_tenant_id = excluded.customerjourneys_tenant_id,
    auth_mode = excluded.auth_mode;

alter table crm.customerjourneys_runtime_links enable row level security;

create policy "crm_read_customerjourneys_runtime_links" on crm.customerjourneys_runtime_links
for select to authenticated
using (crm.is_tenant_member(crm_tenant_id));

create policy "crm_manage_customerjourneys_runtime_links" on crm.customerjourneys_runtime_links
for all to authenticated
using (crm.is_manager_or_admin(crm_tenant_id))
with check (crm.is_manager_or_admin(crm_tenant_id));
