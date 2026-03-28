create table if not exists crm.job_phases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'planned',
  sort_order integer not null default 0,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_job_phases_status_check check (status in ('planned', 'ready', 'in_progress', 'completed'))
);

create table if not exists crm.job_variations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  title text not null,
  description text,
  estimated_value numeric(12,2) not null default 0,
  status text not null default 'draft',
  created_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_job_variations_status_check check (status in ('draft', 'approved', 'declined', 'invoiced'))
);

create trigger crm_job_phases_set_updated_at before update on crm.job_phases for each row execute procedure crm.set_updated_at();
create trigger crm_job_variations_set_updated_at before update on crm.job_variations for each row execute procedure crm.set_updated_at();

create index if not exists crm_job_phases_job_idx on crm.job_phases (tenant_id, job_id, sort_order asc, created_at asc);
create index if not exists crm_job_variations_job_idx on crm.job_variations (tenant_id, job_id, created_at desc);

alter table crm.job_phases enable row level security;
alter table crm.job_variations enable row level security;

create policy "crm_read_job_phases" on crm.job_phases
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_job_phases" on crm.job_phases
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_job_phases" on crm.job_phases
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_job_phases" on crm.job_phases
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_job_variations" on crm.job_variations
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_job_variations" on crm.job_variations
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_job_variations" on crm.job_variations
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_job_variations" on crm.job_variations
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
