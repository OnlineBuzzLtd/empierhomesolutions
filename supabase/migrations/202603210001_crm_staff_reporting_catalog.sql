create table if not exists crm.user_certifications (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references crm.user_profiles(id) on delete cascade,
  title text not null,
  category text not null check (category in ('qualification', 'id', 'compliance', 'training')),
  issuer text,
  issue_date date,
  expiry_date date,
  reminder_days_before integer not null default 30,
  file_url text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  contact_name text,
  email text,
  phone text,
  pricing_last_updated_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.products (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references crm.services(id) on delete set null,
  supplier_id uuid references crm.suppliers(id) on delete set null,
  category text,
  name text not null,
  sku text,
  unit_cost numeric(12,2) not null default 0,
  markup_percent numeric(6,2),
  sell_price numeric(12,2) not null default 0,
  vat_category text not null default 'standard_20',
  active boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.quote_templates (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references crm.services(id) on delete set null,
  job_type_id uuid references crm.job_types(id) on delete set null,
  name text not null,
  description text,
  line_items jsonb not null default '[]'::jsonb,
  optional_extras jsonb not null default '[]'::jsonb,
  payment_terms jsonb,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create trigger crm_products_set_updated_at before update on crm.products for each row execute procedure crm.set_updated_at();

alter table crm.user_certifications enable row level security;
alter table crm.suppliers enable row level security;
alter table crm.products enable row level security;
alter table crm.quote_templates enable row level security;

create policy "crm_authenticated_read_certifications" on crm.user_certifications for select to authenticated using (true);
create policy "crm_manage_certifications" on crm.user_certifications for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_authenticated_read_suppliers" on crm.suppliers for select to authenticated using (true);
create policy "crm_manage_suppliers" on crm.suppliers for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_authenticated_read_products" on crm.products for select to authenticated using (true);
create policy "crm_manage_products" on crm.products for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_authenticated_read_quote_templates" on crm.quote_templates for select to authenticated using (true);
create policy "crm_manage_quote_templates" on crm.quote_templates for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
