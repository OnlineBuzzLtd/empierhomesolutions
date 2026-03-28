create table if not exists crm.job_hazards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_job_hazards_status_check check (status in ('active', 'mitigated', 'hazard_free'))
);

create table if not exists crm.job_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'required',
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_job_checklists_status_check check (status in ('required', 'completed'))
);

create table if not exists crm.job_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  title text not null,
  certificate_number text,
  status text not null default 'draft',
  issued_at date,
  file_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_job_certificates_status_check check (status in ('draft', 'completed', 'sent'))
);

create table if not exists crm.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  supplier_id uuid references crm.suppliers(id) on delete set null,
  po_number text not null,
  status text not null default 'draft',
  total_amount numeric(12,2) not null default 0,
  notes text,
  issued_at date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_purchase_orders_status_check check (status in ('draft', 'issued', 'received', 'reconciled'))
);

create table if not exists crm.supplier_reconciliation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  purchase_order_id uuid references crm.purchase_orders(id) on delete set null,
  supplier_id uuid references crm.suppliers(id) on delete set null,
  entry_type text not null,
  reference_number text,
  amount numeric(12,2) not null,
  status text not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_supplier_reconciliation_entry_type_check check (entry_type in ('invoice', 'credit')),
  constraint crm_supplier_reconciliation_status_check check (status in ('open', 'reconciled'))
);

create trigger crm_job_hazards_set_updated_at before update on crm.job_hazards for each row execute procedure crm.set_updated_at();
create trigger crm_job_checklists_set_updated_at before update on crm.job_checklists for each row execute procedure crm.set_updated_at();
create trigger crm_job_certificates_set_updated_at before update on crm.job_certificates for each row execute procedure crm.set_updated_at();
create trigger crm_purchase_orders_set_updated_at before update on crm.purchase_orders for each row execute procedure crm.set_updated_at();
create trigger crm_supplier_reconciliation_set_updated_at before update on crm.supplier_reconciliation for each row execute procedure crm.set_updated_at();

create index if not exists crm_job_hazards_job_idx on crm.job_hazards (tenant_id, job_id, created_at desc);
create index if not exists crm_job_checklists_job_idx on crm.job_checklists (tenant_id, job_id, created_at desc);
create index if not exists crm_job_certificates_job_idx on crm.job_certificates (tenant_id, job_id, created_at desc);
create index if not exists crm_purchase_orders_job_idx on crm.purchase_orders (tenant_id, job_id, created_at desc);
create index if not exists crm_supplier_reconciliation_job_idx on crm.supplier_reconciliation (tenant_id, job_id, created_at desc);

alter table crm.job_hazards enable row level security;
alter table crm.job_checklists enable row level security;
alter table crm.job_certificates enable row level security;
alter table crm.purchase_orders enable row level security;
alter table crm.supplier_reconciliation enable row level security;

create policy "crm_read_job_hazards" on crm.job_hazards for select to authenticated using (crm.is_tenant_member(tenant_id));
create policy "crm_insert_job_hazards" on crm.job_hazards for insert to authenticated with check (crm.is_tenant_member(tenant_id));
create policy "crm_update_job_hazards" on crm.job_hazards for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));
create policy "crm_delete_job_hazards" on crm.job_hazards for delete to authenticated using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_job_checklists" on crm.job_checklists for select to authenticated using (crm.is_tenant_member(tenant_id));
create policy "crm_insert_job_checklists" on crm.job_checklists for insert to authenticated with check (crm.is_tenant_member(tenant_id));
create policy "crm_update_job_checklists" on crm.job_checklists for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));
create policy "crm_delete_job_checklists" on crm.job_checklists for delete to authenticated using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_job_certificates" on crm.job_certificates for select to authenticated using (crm.is_tenant_member(tenant_id));
create policy "crm_insert_job_certificates" on crm.job_certificates for insert to authenticated with check (crm.is_tenant_member(tenant_id));
create policy "crm_update_job_certificates" on crm.job_certificates for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));
create policy "crm_delete_job_certificates" on crm.job_certificates for delete to authenticated using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_purchase_orders" on crm.purchase_orders for select to authenticated using (crm.is_tenant_member(tenant_id));
create policy "crm_insert_purchase_orders" on crm.purchase_orders for insert to authenticated with check (crm.is_tenant_member(tenant_id));
create policy "crm_update_purchase_orders" on crm.purchase_orders for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));
create policy "crm_delete_purchase_orders" on crm.purchase_orders for delete to authenticated using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_supplier_reconciliation" on crm.supplier_reconciliation for select to authenticated using (crm.is_tenant_member(tenant_id));
create policy "crm_insert_supplier_reconciliation" on crm.supplier_reconciliation for insert to authenticated with check (crm.is_tenant_member(tenant_id));
create policy "crm_update_supplier_reconciliation" on crm.supplier_reconciliation for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));
create policy "crm_delete_supplier_reconciliation" on crm.supplier_reconciliation for delete to authenticated using (crm.is_manager_or_admin(tenant_id));
