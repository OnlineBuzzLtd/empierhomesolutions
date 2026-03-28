create table if not exists crm.sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  label text not null,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  access_notes text,
  parking_notes text,
  is_primary boolean not null default false,
  is_demo boolean not null default false,
  demo_scenario_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.site_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  site_id uuid not null references crm.sites(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role_label text,
  is_primary boolean not null default false,
  is_demo boolean not null default false,
  demo_scenario_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.job_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  user_profile_id uuid not null references crm.user_profiles(id) on delete cascade,
  assignment_role text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, user_profile_id)
);

alter table crm.jobs add column if not exists site_id uuid references crm.sites(id) on delete set null;
alter table crm.jobs add column if not exists site_contact_id uuid references crm.site_contacts(id) on delete set null;

create trigger crm_sites_set_updated_at before update on crm.sites for each row execute procedure crm.set_updated_at();
create trigger crm_site_contacts_set_updated_at before update on crm.site_contacts for each row execute procedure crm.set_updated_at();

create index if not exists crm_sites_customer_idx on crm.sites (tenant_id, customer_id, is_primary desc, created_at desc);
create index if not exists crm_site_contacts_site_idx on crm.site_contacts (tenant_id, site_id, is_primary desc, created_at desc);
create index if not exists crm_job_assignees_job_idx on crm.job_assignees (tenant_id, job_id, created_at asc);

alter table crm.sites enable row level security;
alter table crm.site_contacts enable row level security;
alter table crm.job_assignees enable row level security;

create policy "crm_read_sites" on crm.sites
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_sites" on crm.sites
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_sites" on crm.sites
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_sites" on crm.sites
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_site_contacts" on crm.site_contacts
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_site_contacts" on crm.site_contacts
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_site_contacts" on crm.site_contacts
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_site_contacts" on crm.site_contacts
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_job_assignees" on crm.job_assignees
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_job_assignees" on crm.job_assignees
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_job_assignees" on crm.job_assignees
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_job_assignees" on crm.job_assignees
for delete to authenticated
using (crm.is_tenant_member(tenant_id));
