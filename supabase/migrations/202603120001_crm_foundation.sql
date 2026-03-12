create schema if not exists crm;

create type crm.role as enum ('management', 'admin', 'sales', 'engineer', 'accounts');
create type crm.lead_status as enum ('new', 'contacted', 'follow_up', 'survey_booked', 'quoted', 'accepted', 'booked', 'completed', 'lost');
create type crm.job_status as enum ('enquiry', 'booked', 'in_progress', 'completed', 'invoiced');
create type crm.quote_status as enum ('draft', 'sent', 'accepted', 'declined');
create type crm.invoice_status as enum ('unpaid', 'paid', 'overdue', 'void');
create type crm.payment_status as enum ('requested', 'received', 'failed', 'refunded');
create type crm.payment_type as enum ('deposit', 'stage', 'final', 'finance');
create type crm.expense_category as enum ('materials', 'travel', 'subcontractor', 'other');
create type crm.appointment_type as enum ('call', 'follow_up', 'survey', 'booking', 'meeting', 'reminder');
create type crm.appointment_status as enum ('scheduled', 'completed', 'cancelled');
create type crm.custom_field_type as enum ('text', 'textarea', 'number', 'select', 'multiselect', 'date', 'boolean', 'file');

create extension if not exists pgcrypto;

create or replace function crm.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists crm.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role crm.role not null default 'admin',
  full_name text not null,
  phone text,
  email text,
  emergency_contact text,
  agreed_hours text,
  pay_type text,
  pay_notes text,
  contract_file_url text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  launch_date date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.job_types (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references crm.services(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (service_id, slug)
);

create table if not exists crm.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  property_type text,
  occupancy_type text,
  source text,
  referral_notes text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references crm.customers(id) on delete set null,
  service_id uuid references crm.services(id) on delete set null,
  job_type_id uuid references crm.job_types(id) on delete set null,
  status crm.lead_status not null default 'new',
  lost_reason text,
  source text,
  assigned_to uuid references auth.users(id) on delete set null,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.customer_assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  service_id uuid references crm.services(id) on delete set null,
  asset_type text not null,
  make text,
  model text,
  serial_number text,
  install_date date,
  service_due_date date,
  warranty_end_date date,
  cylinder_type text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  lead_id uuid references crm.leads(id) on delete set null,
  service_id uuid references crm.services(id) on delete set null,
  job_type_id uuid references crm.job_types(id) on delete set null,
  title text not null,
  description text,
  scheduled_date date,
  scheduled_time time,
  duration_hours numeric(6,2),
  status crm.job_status not null default 'enquiry',
  assigned_engineer text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer', 'job', 'lead')),
  entity_id uuid not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references crm.customers(id) on delete set null,
  lead_id uuid references crm.leads(id) on delete set null,
  job_id uuid references crm.jobs(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  type crm.appointment_type not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status crm.appointment_status not null default 'scheduled',
  reminder_offset_minutes integer,
  recurrence_rule text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references crm.jobs(id) on delete cascade,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  quote_number text not null unique,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  vat_rate numeric(6,4) not null default 0.2,
  vat_category text not null default 'standard_20',
  total numeric(12,2) not null default 0,
  status crm.quote_status not null default 'draft',
  valid_until date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.invoices (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references crm.quotes(id) on delete set null,
  job_id uuid not null references crm.jobs(id) on delete cascade,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  invoice_number text not null unique,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  vat_rate numeric(6,4) not null default 0.2,
  vat_category text not null default 'standard_20',
  total numeric(12,2) not null default 0,
  status crm.invoice_status not null default 'unpaid',
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references crm.invoices(id) on delete set null,
  quote_id uuid references crm.quotes(id) on delete set null,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  payment_type crm.payment_type not null,
  amount numeric(12,2) not null,
  status crm.payment_status not null default 'requested',
  requested_at timestamptz,
  received_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.expenses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references crm.jobs(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  category crm.expense_category not null,
  receipt_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'customer', 'asset', 'job', 'quote', 'invoice')),
  service_id uuid references crm.services(id) on delete set null,
  job_type_id uuid references crm.job_types(id) on delete set null,
  field_key text not null unique,
  label text not null,
  field_type crm.custom_field_type not null,
  options jsonb,
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  field_definition_id uuid not null references crm.custom_field_definitions(id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'customer', 'asset', 'job', 'quote', 'invoice')),
  entity_id uuid not null,
  value_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (field_definition_id, entity_type, entity_id)
);

create table if not exists crm.required_document_rules (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'job', 'asset')),
  service_id uuid references crm.services(id) on delete set null,
  job_type_id uuid references crm.job_types(id) on delete set null,
  pipeline_stage text,
  document_type text not null,
  required boolean not null default true,
  due_within_days integer,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.number_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text not null unique,
  current_value integer not null default 0
);

create or replace function crm.next_sequence(p_sequence_key text)
returns integer
language plpgsql
security definer
as $$
declare
  next_value integer;
begin
  insert into crm.number_sequences(sequence_key, current_value)
  values (p_sequence_key, 1)
  on conflict (sequence_key)
  do update set current_value = crm.number_sequences.current_value + 1
  returning current_value into next_value;

  return next_value;
end;
$$;

create or replace function crm.is_manager_or_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from crm.user_profiles
    where user_id = auth.uid()
      and role in ('management', 'admin')
      and active = true
  );
$$;

create or replace function crm.sync_user_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into crm.user_profiles (user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists crm_sync_user_profile on auth.users;
create trigger crm_sync_user_profile
after insert on auth.users
for each row execute procedure crm.sync_user_profile();

create trigger crm_user_profiles_set_updated_at before update on crm.user_profiles for each row execute procedure crm.set_updated_at();
create trigger crm_customers_set_updated_at before update on crm.customers for each row execute procedure crm.set_updated_at();
create trigger crm_leads_set_updated_at before update on crm.leads for each row execute procedure crm.set_updated_at();
create trigger crm_customer_assets_set_updated_at before update on crm.customer_assets for each row execute procedure crm.set_updated_at();
create trigger crm_jobs_set_updated_at before update on crm.jobs for each row execute procedure crm.set_updated_at();
create trigger crm_custom_field_values_set_updated_at before update on crm.custom_field_values for each row execute procedure crm.set_updated_at();

alter table crm.user_profiles enable row level security;
alter table crm.services enable row level security;
alter table crm.job_types enable row level security;
alter table crm.customers enable row level security;
alter table crm.leads enable row level security;
alter table crm.customer_assets enable row level security;
alter table crm.jobs enable row level security;
alter table crm.notes enable row level security;
alter table crm.appointments enable row level security;
alter table crm.quotes enable row level security;
alter table crm.invoices enable row level security;
alter table crm.payments enable row level security;
alter table crm.expenses enable row level security;
alter table crm.attachments enable row level security;
alter table crm.custom_field_definitions enable row level security;
alter table crm.custom_field_values enable row level security;
alter table crm.required_document_rules enable row level security;

create policy "crm_authenticated_read" on crm.services for select to authenticated using (true);
create policy "crm_authenticated_manage_services" on crm.services for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_authenticated_read_job_types" on crm.job_types for select to authenticated using (true);
create policy "crm_authenticated_manage_job_types" on crm.job_types for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_authenticated_manage_profiles" on crm.user_profiles for select to authenticated using (true);
create policy "crm_admin_update_profiles" on crm.user_profiles for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());

create policy "crm_authenticated_customers" on crm.customers for all to authenticated using (true) with check (true);
create policy "crm_authenticated_leads" on crm.leads for all to authenticated using (true) with check (true);
create policy "crm_authenticated_assets" on crm.customer_assets for all to authenticated using (true) with check (true);
create policy "crm_authenticated_jobs" on crm.jobs for all to authenticated using (true) with check (true);
create policy "crm_authenticated_notes" on crm.notes for all to authenticated using (true) with check (true);
create policy "crm_authenticated_appointments" on crm.appointments for all to authenticated using (true) with check (true);
create policy "crm_authenticated_quotes" on crm.quotes for all to authenticated using (true) with check (true);
create policy "crm_authenticated_invoices" on crm.invoices for all to authenticated using (true) with check (true);
create policy "crm_authenticated_payments" on crm.payments for all to authenticated using (true) with check (true);
create policy "crm_authenticated_expenses" on crm.expenses for all to authenticated using (true) with check (true);
create policy "crm_authenticated_attachments" on crm.attachments for all to authenticated using (true) with check (true);
create policy "crm_authenticated_read_custom_fields" on crm.custom_field_definitions for select to authenticated using (true);
create policy "crm_manage_custom_fields" on crm.custom_field_definitions for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_authenticated_custom_field_values" on crm.custom_field_values for all to authenticated using (true) with check (true);
create policy "crm_authenticated_read_required_document_rules" on crm.required_document_rules for select to authenticated using (true);
create policy "crm_manage_required_document_rules" on crm.required_document_rules for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());

insert into storage.buckets (id, name, public)
values ('crm-uploads', 'crm-uploads', false)
on conflict (id) do update
set public = excluded.public;
