create table if not exists crm.contact_opt_outs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  contact text not null,
  normalized_contact text not null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  source text not null default 'manual',
  opted_out_at timestamptz not null default timezone('utc', now()),
  opted_in_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, normalized_contact, channel)
);

create trigger crm_contact_opt_outs_set_updated_at
before update on crm.contact_opt_outs
for each row execute procedure crm.set_updated_at();

create index if not exists crm_contact_opt_outs_tenant_contact_idx
  on crm.contact_opt_outs (tenant_id, normalized_contact, channel);

alter table crm.contact_opt_outs enable row level security;

create policy "crm_read_contact_opt_outs" on crm.contact_opt_outs
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_contact_opt_outs" on crm.contact_opt_outs
for insert to authenticated
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_contact_opt_outs" on crm.contact_opt_outs
for update to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_delete_contact_opt_outs" on crm.contact_opt_outs
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
