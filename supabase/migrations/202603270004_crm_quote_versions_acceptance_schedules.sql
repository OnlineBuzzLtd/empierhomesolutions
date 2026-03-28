alter table crm.quotes add column if not exists document_type text not null default 'quote';
alter table crm.quotes add column if not exists current_version_number integer not null default 1;

alter table crm.quotes
  drop constraint if exists crm_quotes_document_type_check;

alter table crm.quotes
  add constraint crm_quotes_document_type_check check (document_type in ('quote', 'estimate'));

create table if not exists crm.quote_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  quote_id uuid not null references crm.quotes(id) on delete cascade,
  version_number integer not null,
  document_type text not null default 'quote',
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  vat_rate numeric(5,4) not null default 0.2,
  vat_category text not null default 'standard_20',
  total numeric(12,2) not null default 0,
  valid_until date,
  status text not null default 'draft',
  change_summary text,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  unique (quote_id, version_number),
  constraint crm_quote_versions_document_type_check check (document_type in ('quote', 'estimate')),
  constraint crm_quote_versions_status_check check (status in ('draft', 'sent', 'accepted', 'declined'))
);

create table if not exists crm.quote_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  quote_id uuid not null unique references crm.quotes(id) on delete cascade,
  accepted_by_name text not null,
  accepted_by_email text,
  acceptance_method text not null,
  notes text,
  accepted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.invoice_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  quote_id uuid not null references crm.quotes(id) on delete cascade,
  label text not null,
  payment_type text not null,
  percentage numeric(6,2),
  fixed_amount numeric(12,2),
  due_offset_days integer not null default 14,
  status text not null default 'planned',
  invoice_id uuid references crm.invoices(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_invoice_schedules_payment_type_check check (payment_type in ('deposit', 'stage', 'final', 'finance')),
  constraint crm_invoice_schedules_status_check check (status in ('planned', 'invoiced', 'paid')),
  constraint crm_invoice_schedules_amount_source_check check (
    (percentage is not null and fixed_amount is null)
    or (percentage is null and fixed_amount is not null)
  )
);

insert into crm.quote_versions (
  tenant_id,
  quote_id,
  version_number,
  document_type,
  line_items,
  subtotal,
  vat_rate,
  vat_category,
  total,
  valid_until,
  status,
  created_at
)
select
  q.tenant_id,
  q.id,
  coalesce(q.current_version_number, 1),
  q.document_type,
  q.line_items,
  q.subtotal,
  q.vat_rate,
  q.vat_category,
  q.total,
  q.valid_until,
  q.status,
  q.created_at
from crm.quotes q
where not exists (
  select 1 from crm.quote_versions v where v.quote_id = q.id
);

create trigger crm_invoice_schedules_set_updated_at before update on crm.invoice_schedules for each row execute procedure crm.set_updated_at();

create index if not exists crm_quote_versions_quote_idx on crm.quote_versions (tenant_id, quote_id, version_number desc);
create index if not exists crm_invoice_schedules_quote_idx on crm.invoice_schedules (tenant_id, quote_id, created_at asc);

alter table crm.quote_versions enable row level security;
alter table crm.quote_acceptances enable row level security;
alter table crm.invoice_schedules enable row level security;

create policy "crm_read_quote_versions" on crm.quote_versions
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_quote_versions" on crm.quote_versions
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_quote_versions" on crm.quote_versions
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_quote_versions" on crm.quote_versions
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_quote_acceptances" on crm.quote_acceptances
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_quote_acceptances" on crm.quote_acceptances
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_quote_acceptances" on crm.quote_acceptances
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_quote_acceptances" on crm.quote_acceptances
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_invoice_schedules" on crm.invoice_schedules
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_invoice_schedules" on crm.invoice_schedules
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_invoice_schedules" on crm.invoice_schedules
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_invoice_schedules" on crm.invoice_schedules
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
