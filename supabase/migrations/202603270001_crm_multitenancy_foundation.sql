create extension if not exists pgcrypto;

create table if not exists crm.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('trial', 'active', 'suspended', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references crm.tenants(id) on delete cascade,
  legal_name text,
  vat_registration_number text,
  gas_safe_number text,
  invoice_footer text,
  quote_footer text,
  certificate_footer text,
  default_payment_terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.tenant_branding (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references crm.tenants(id) on delete cascade,
  business_name text not null,
  crm_display_name text,
  primary_phone text,
  support_email text,
  website_url text,
  logo_url text,
  accent_color text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role crm.role not null default 'admin',
  active boolean not null default true,
  is_owner boolean not null default false,
  is_demo boolean not null default false,
  demo_scenario_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, user_id)
);

create trigger crm_tenants_set_updated_at before update on crm.tenants for each row execute procedure crm.set_updated_at();
create trigger crm_tenant_settings_set_updated_at before update on crm.tenant_settings for each row execute procedure crm.set_updated_at();
create trigger crm_tenant_branding_set_updated_at before update on crm.tenant_branding for each row execute procedure crm.set_updated_at();
create trigger crm_tenant_memberships_set_updated_at before update on crm.tenant_memberships for each row execute procedure crm.set_updated_at();

insert into crm.tenants (id, slug, name, status)
values ('11111111-1111-4111-8111-111111111111', 'empire-home-solutions', 'Empire Home Solutions', 'active')
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    status = excluded.status;

insert into crm.tenant_branding (
  tenant_id,
  business_name,
  crm_display_name,
  primary_phone,
  support_email,
  accent_color
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Empire Home Solutions',
  'Empire CRM',
  '01895 725 151',
  'info@empirehomesolutions.co.uk',
  '#0f172a'
)
on conflict (tenant_id) do update
set business_name = excluded.business_name,
    crm_display_name = excluded.crm_display_name,
    primary_phone = excluded.primary_phone,
    support_email = excluded.support_email,
    accent_color = excluded.accent_color;

insert into crm.tenant_settings (
  tenant_id,
  legal_name,
  vat_registration_number,
  gas_safe_number
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Empire Home Solutions',
  '494433664',
  '663578'
)
on conflict (tenant_id) do update
set legal_name = excluded.legal_name,
    vat_registration_number = excluded.vat_registration_number,
    gas_safe_number = excluded.gas_safe_number;

create or replace function crm.current_user_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id
  from crm.tenant_memberships
  where user_id = auth.uid()
    and active = true
  order by is_owner desc, created_at asc
  limit 1
$$;

create or replace function crm.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from crm.tenant_memberships
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and active = true
  )
$$;

create or replace function crm.is_active_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from crm.tenant_memberships
    where user_id = auth.uid()
      and active = true
  )
$$;

create or replace function crm.is_manager_or_admin(p_tenant_id uuid default crm.current_user_tenant_id())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from crm.tenant_memberships
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and role in ('management', 'admin')
      and active = true
  )
$$;

alter table crm.user_profiles add column if not exists tenant_id uuid;
alter table crm.services add column if not exists tenant_id uuid;
alter table crm.job_types add column if not exists tenant_id uuid;
alter table crm.customers add column if not exists tenant_id uuid;
alter table crm.leads add column if not exists tenant_id uuid;
alter table crm.customer_assets add column if not exists tenant_id uuid;
alter table crm.jobs add column if not exists tenant_id uuid;
alter table crm.notes add column if not exists tenant_id uuid;
alter table crm.appointments add column if not exists tenant_id uuid;
alter table crm.quotes add column if not exists tenant_id uuid;
alter table crm.invoices add column if not exists tenant_id uuid;
alter table crm.payments add column if not exists tenant_id uuid;
alter table crm.expenses add column if not exists tenant_id uuid;
alter table crm.attachments add column if not exists tenant_id uuid;
alter table crm.custom_field_definitions add column if not exists tenant_id uuid;
alter table crm.custom_field_values add column if not exists tenant_id uuid;
alter table crm.required_document_rules add column if not exists tenant_id uuid;
alter table crm.number_sequences add column if not exists tenant_id uuid;
alter table crm.user_certifications add column if not exists tenant_id uuid;
alter table crm.suppliers add column if not exists tenant_id uuid;
alter table crm.products add column if not exists tenant_id uuid;
alter table crm.quote_templates add column if not exists tenant_id uuid;
alter table crm.product_addons add column if not exists tenant_id uuid;
alter table crm.ai_conversations add column if not exists tenant_id uuid;
alter table crm.ai_messages add column if not exists tenant_id uuid;
alter table crm.ai_actions add column if not exists tenant_id uuid;
alter table crm.ai_crm_impacts add column if not exists tenant_id uuid;

update crm.user_profiles set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.services set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.job_types set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.customers set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.leads set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.customer_assets set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.jobs set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.notes set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.appointments set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.quotes set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.invoices set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.payments set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.expenses set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.attachments set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.custom_field_definitions set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.custom_field_values set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.required_document_rules set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.number_sequences set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.user_certifications set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.suppliers set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.products set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.quote_templates set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.product_addons set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.ai_conversations set tenant_id = '11111111-1111-4111-8111-111111111111' where tenant_id is null;
update crm.ai_messages set tenant_id = coalesce(tenant_id, (select c.tenant_id from crm.ai_conversations c where c.id = crm.ai_messages.conversation_id));
update crm.ai_actions set tenant_id = coalesce(tenant_id, (select c.tenant_id from crm.ai_conversations c where c.id = crm.ai_actions.conversation_id));
update crm.ai_crm_impacts set tenant_id = coalesce(tenant_id, (select c.tenant_id from crm.ai_conversations c where c.id = crm.ai_crm_impacts.conversation_id));

alter table crm.user_profiles alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.services alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.job_types alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.customers alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.leads alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.customer_assets alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.jobs alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.notes alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.appointments alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.quotes alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.invoices alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.payments alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.expenses alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.attachments alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.custom_field_definitions alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.custom_field_values alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.required_document_rules alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.number_sequences alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.user_certifications alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.suppliers alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.products alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.quote_templates alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.product_addons alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.ai_conversations alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.ai_messages alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.ai_actions alter column tenant_id set default crm.current_user_tenant_id();
alter table crm.ai_crm_impacts alter column tenant_id set default crm.current_user_tenant_id();

alter table crm.user_profiles alter column tenant_id set not null;
alter table crm.services alter column tenant_id set not null;
alter table crm.job_types alter column tenant_id set not null;
alter table crm.customers alter column tenant_id set not null;
alter table crm.leads alter column tenant_id set not null;
alter table crm.customer_assets alter column tenant_id set not null;
alter table crm.jobs alter column tenant_id set not null;
alter table crm.notes alter column tenant_id set not null;
alter table crm.appointments alter column tenant_id set not null;
alter table crm.quotes alter column tenant_id set not null;
alter table crm.invoices alter column tenant_id set not null;
alter table crm.payments alter column tenant_id set not null;
alter table crm.expenses alter column tenant_id set not null;
alter table crm.attachments alter column tenant_id set not null;
alter table crm.custom_field_definitions alter column tenant_id set not null;
alter table crm.custom_field_values alter column tenant_id set not null;
alter table crm.required_document_rules alter column tenant_id set not null;
alter table crm.number_sequences alter column tenant_id set not null;
alter table crm.user_certifications alter column tenant_id set not null;
alter table crm.suppliers alter column tenant_id set not null;
alter table crm.products alter column tenant_id set not null;
alter table crm.quote_templates alter column tenant_id set not null;
alter table crm.product_addons alter column tenant_id set not null;
alter table crm.ai_conversations alter column tenant_id set not null;
alter table crm.ai_messages alter column tenant_id set not null;
alter table crm.ai_actions alter column tenant_id set not null;
alter table crm.ai_crm_impacts alter column tenant_id set not null;

alter table crm.user_profiles add constraint user_profiles_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.services add constraint services_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.job_types add constraint job_types_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.customers add constraint customers_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.leads add constraint leads_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.customer_assets add constraint customer_assets_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.jobs add constraint jobs_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.notes add constraint notes_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.appointments add constraint appointments_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.quotes add constraint quotes_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.invoices add constraint invoices_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.payments add constraint payments_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.expenses add constraint expenses_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.attachments add constraint attachments_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.custom_field_definitions add constraint custom_field_definitions_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.custom_field_values add constraint custom_field_values_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.required_document_rules add constraint required_document_rules_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.number_sequences add constraint number_sequences_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.user_certifications add constraint user_certifications_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.suppliers add constraint suppliers_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.products add constraint products_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.quote_templates add constraint quote_templates_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.product_addons add constraint product_addons_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.ai_conversations add constraint ai_conversations_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.ai_messages add constraint ai_messages_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.ai_actions add constraint ai_actions_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;
alter table crm.ai_crm_impacts add constraint ai_crm_impacts_tenant_id_fkey foreign key (tenant_id) references crm.tenants(id) on delete cascade;

alter table crm.user_profiles drop constraint if exists user_profiles_user_id_key;
alter table crm.services drop constraint if exists services_slug_key;
alter table crm.custom_field_definitions drop constraint if exists custom_field_definitions_field_key_key;
alter table crm.custom_field_values drop constraint if exists custom_field_values_field_definition_id_entity_type_entity_id_key;
alter table crm.quotes drop constraint if exists quotes_quote_number_key;
alter table crm.invoices drop constraint if exists invoices_invoice_number_key;
alter table crm.number_sequences drop constraint if exists number_sequences_sequence_key_key;
alter table crm.product_addons drop constraint if exists product_addons_addon_key_key;
alter table crm.ai_conversations drop constraint if exists ai_conversations_scenario_key_key;

create unique index if not exists crm_user_profiles_tenant_user_idx on crm.user_profiles (tenant_id, user_id);
create unique index if not exists crm_services_tenant_slug_idx on crm.services (tenant_id, slug);
create unique index if not exists crm_custom_field_definitions_tenant_field_idx on crm.custom_field_definitions (tenant_id, field_key);
create unique index if not exists crm_quotes_tenant_number_idx on crm.quotes (tenant_id, quote_number);
create unique index if not exists crm_invoices_tenant_number_idx on crm.invoices (tenant_id, invoice_number);
create unique index if not exists crm_number_sequences_tenant_key_idx on crm.number_sequences (tenant_id, sequence_key);
create unique index if not exists crm_product_addons_tenant_key_idx on crm.product_addons (tenant_id, addon_key);
create unique index if not exists crm_ai_conversations_tenant_scenario_idx on crm.ai_conversations (tenant_id, scenario_key);
create unique index if not exists crm_custom_field_values_tenant_unique_idx on crm.custom_field_values (tenant_id, field_definition_id, entity_type, entity_id);

drop index if exists crm_product_addons_key_idx;
create index if not exists crm_product_addons_key_idx on crm.product_addons (tenant_id, addon_key);
drop index if exists crm_ai_conversations_demo_idx;
create index if not exists crm_ai_conversations_demo_idx on crm.ai_conversations (tenant_id, is_demo, demo_scenario_key, scenario_key);
create index if not exists crm_user_profiles_tenant_idx on crm.user_profiles (tenant_id, full_name);

insert into crm.tenant_memberships (
  tenant_id,
  user_id,
  role,
  active,
  is_owner,
  is_demo,
  demo_scenario_key
)
select
  tenant_id,
  user_id,
  role,
  active,
  role in ('management', 'admin'),
  coalesce(is_demo, false),
  demo_scenario_key
from crm.user_profiles
on conflict (tenant_id, user_id) do update
set role = excluded.role,
    active = excluded.active,
    is_owner = excluded.is_owner,
    is_demo = excluded.is_demo,
    demo_scenario_key = excluded.demo_scenario_key;

create or replace function crm.next_sequence(p_sequence_key text, p_tenant_id uuid default crm.current_user_tenant_id())
returns integer
language plpgsql
security definer
as $$
declare
  next_value integer;
begin
  if p_tenant_id is null then
    raise exception 'CRM tenant context is required for sequence allocation';
  end if;

  insert into crm.number_sequences(tenant_id, sequence_key, current_value)
  values (p_tenant_id, p_sequence_key, 1)
  on conflict (tenant_id, sequence_key)
  do update set current_value = crm.number_sequences.current_value + 1
  returning current_value into next_value;

  return next_value;
end;
$$;

create or replace function crm.sync_user_profile()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_role crm.role;
  v_is_owner boolean;
  v_is_demo boolean;
  v_demo_scenario_key text;
begin
  v_tenant_id := nullif(new.raw_user_meta_data ->> 'crm_tenant_id', '')::uuid;

  if v_tenant_id is null then
    return new;
  end if;

  v_role := coalesce(nullif(new.raw_user_meta_data ->> 'crm_role', '')::crm.role, 'admin');
  v_is_owner := coalesce((new.raw_user_meta_data ->> 'crm_is_owner')::boolean, false);
  v_is_demo := coalesce((new.raw_user_meta_data ->> 'crm_is_demo')::boolean, false);
  v_demo_scenario_key := nullif(new.raw_user_meta_data ->> 'crm_demo_scenario_key', '');

  insert into crm.user_profiles (
    tenant_id,
    user_id,
    role,
    full_name,
    email,
    active,
    is_demo,
    demo_scenario_key
  )
  values (
    v_tenant_id,
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    true,
    v_is_demo,
    v_demo_scenario_key
  )
  on conflict (tenant_id, user_id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      is_demo = excluded.is_demo,
      demo_scenario_key = excluded.demo_scenario_key;

  insert into crm.tenant_memberships (
    tenant_id,
    user_id,
    role,
    active,
    is_owner,
    is_demo,
    demo_scenario_key
  )
  values (
    v_tenant_id,
    new.id,
    v_role,
    true,
    v_is_owner,
    v_is_demo,
    v_demo_scenario_key
  )
  on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      active = excluded.active,
      is_owner = excluded.is_owner,
      is_demo = excluded.is_demo,
      demo_scenario_key = excluded.demo_scenario_key;

  return new;
end;
$$;

alter table crm.tenants enable row level security;
alter table crm.tenant_settings enable row level security;
alter table crm.tenant_branding enable row level security;
alter table crm.tenant_memberships enable row level security;

drop policy if exists "crm_read_tenants" on crm.tenants;
drop policy if exists "crm_manage_tenants" on crm.tenants;
drop policy if exists "crm_read_tenant_settings" on crm.tenant_settings;
drop policy if exists "crm_manage_tenant_settings" on crm.tenant_settings;
drop policy if exists "crm_read_tenant_branding" on crm.tenant_branding;
drop policy if exists "crm_manage_tenant_branding" on crm.tenant_branding;
drop policy if exists "crm_read_tenant_memberships" on crm.tenant_memberships;
drop policy if exists "crm_manage_tenant_memberships" on crm.tenant_memberships;

create policy "crm_read_tenants" on crm.tenants
for select to authenticated
using (crm.is_tenant_member(id));

create policy "crm_manage_tenants" on crm.tenants
for update to authenticated
using (crm.is_manager_or_admin(id))
with check (crm.is_manager_or_admin(id));

create policy "crm_read_tenant_settings" on crm.tenant_settings
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_tenant_settings" on crm.tenant_settings
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_tenant_branding" on crm.tenant_branding
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_tenant_branding" on crm.tenant_branding
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_tenant_memberships" on crm.tenant_memberships
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_tenant_memberships" on crm.tenant_memberships
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

drop policy if exists "crm_authenticated_manage_profiles" on crm.user_profiles;
drop policy if exists "crm_admin_update_profiles" on crm.user_profiles;
drop policy if exists "crm_authenticated_read" on crm.services;
drop policy if exists "crm_authenticated_manage_services" on crm.services;
drop policy if exists "crm_authenticated_read_job_types" on crm.job_types;
drop policy if exists "crm_authenticated_manage_job_types" on crm.job_types;
drop policy if exists "crm_authenticated_read_custom_fields" on crm.custom_field_definitions;
drop policy if exists "crm_manage_custom_fields" on crm.custom_field_definitions;
drop policy if exists "crm_authenticated_read_required_document_rules" on crm.required_document_rules;
drop policy if exists "crm_manage_required_document_rules" on crm.required_document_rules;
drop policy if exists "crm_authenticated_read_certifications" on crm.user_certifications;
drop policy if exists "crm_manage_certifications" on crm.user_certifications;
drop policy if exists "crm_authenticated_read_suppliers" on crm.suppliers;
drop policy if exists "crm_manage_suppliers" on crm.suppliers;
drop policy if exists "crm_authenticated_read_products" on crm.products;
drop policy if exists "crm_manage_products" on crm.products;
drop policy if exists "crm_authenticated_read_quote_templates" on crm.quote_templates;
drop policy if exists "crm_manage_quote_templates" on crm.quote_templates;
drop policy if exists "crm_read_product_addons" on crm.product_addons;
drop policy if exists "crm_manage_product_addons" on crm.product_addons;
drop policy if exists "crm_read_ai_conversations" on crm.ai_conversations;
drop policy if exists "crm_manage_ai_conversations" on crm.ai_conversations;
drop policy if exists "crm_read_ai_messages" on crm.ai_messages;
drop policy if exists "crm_manage_ai_messages" on crm.ai_messages;
drop policy if exists "crm_read_ai_actions" on crm.ai_actions;
drop policy if exists "crm_manage_ai_actions" on crm.ai_actions;
drop policy if exists "crm_read_ai_crm_impacts" on crm.ai_crm_impacts;
drop policy if exists "crm_manage_ai_crm_impacts" on crm.ai_crm_impacts;

create policy "crm_read_user_profiles" on crm.user_profiles
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_user_profiles" on crm.user_profiles
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_services" on crm.services
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_services" on crm.services
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_job_types" on crm.job_types
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_job_types" on crm.job_types
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_custom_field_definitions" on crm.custom_field_definitions
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_custom_field_definitions" on crm.custom_field_definitions
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_required_document_rules_v2" on crm.required_document_rules
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_required_document_rules_v2" on crm.required_document_rules
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_user_certifications" on crm.user_certifications
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_user_certifications" on crm.user_certifications
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_suppliers_v2" on crm.suppliers
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_suppliers_v2" on crm.suppliers
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_products_v2" on crm.products
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_products_v2" on crm.products
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_quote_templates_v2" on crm.quote_templates
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_quote_templates_v2" on crm.quote_templates
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_product_addons_v2" on crm.product_addons
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_product_addons_v2" on crm.product_addons
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_ai_conversations_v2" on crm.ai_conversations
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_ai_conversations_v2" on crm.ai_conversations
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_ai_messages_v2" on crm.ai_messages
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_ai_messages_v2" on crm.ai_messages
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_ai_actions_v2" on crm.ai_actions
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_ai_actions_v2" on crm.ai_actions
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_ai_crm_impacts_v2" on crm.ai_crm_impacts
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_ai_crm_impacts_v2" on crm.ai_crm_impacts
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

drop policy if exists "crm_read_customers" on crm.customers;
drop policy if exists "crm_insert_customers" on crm.customers;
drop policy if exists "crm_update_customers" on crm.customers;
drop policy if exists "crm_delete_customers" on crm.customers;
drop policy if exists "crm_read_leads" on crm.leads;
drop policy if exists "crm_insert_leads" on crm.leads;
drop policy if exists "crm_update_leads" on crm.leads;
drop policy if exists "crm_delete_leads" on crm.leads;
drop policy if exists "crm_read_customer_assets" on crm.customer_assets;
drop policy if exists "crm_insert_customer_assets" on crm.customer_assets;
drop policy if exists "crm_update_customer_assets" on crm.customer_assets;
drop policy if exists "crm_delete_customer_assets" on crm.customer_assets;
drop policy if exists "crm_read_jobs" on crm.jobs;
drop policy if exists "crm_insert_jobs" on crm.jobs;
drop policy if exists "crm_update_jobs" on crm.jobs;
drop policy if exists "crm_delete_jobs" on crm.jobs;
drop policy if exists "crm_read_notes" on crm.notes;
drop policy if exists "crm_insert_notes" on crm.notes;
drop policy if exists "crm_update_notes" on crm.notes;
drop policy if exists "crm_delete_notes" on crm.notes;
drop policy if exists "crm_read_appointments" on crm.appointments;
drop policy if exists "crm_insert_appointments" on crm.appointments;
drop policy if exists "crm_update_appointments" on crm.appointments;
drop policy if exists "crm_delete_appointments" on crm.appointments;
drop policy if exists "crm_read_quotes" on crm.quotes;
drop policy if exists "crm_insert_quotes" on crm.quotes;
drop policy if exists "crm_update_quotes" on crm.quotes;
drop policy if exists "crm_delete_quotes" on crm.quotes;
drop policy if exists "crm_read_invoices" on crm.invoices;
drop policy if exists "crm_insert_invoices" on crm.invoices;
drop policy if exists "crm_update_invoices" on crm.invoices;
drop policy if exists "crm_delete_invoices" on crm.invoices;
drop policy if exists "crm_read_payments" on crm.payments;
drop policy if exists "crm_insert_payments" on crm.payments;
drop policy if exists "crm_update_payments" on crm.payments;
drop policy if exists "crm_delete_payments" on crm.payments;
drop policy if exists "crm_read_expenses" on crm.expenses;
drop policy if exists "crm_insert_expenses" on crm.expenses;
drop policy if exists "crm_update_expenses" on crm.expenses;
drop policy if exists "crm_delete_expenses" on crm.expenses;
drop policy if exists "crm_read_attachments" on crm.attachments;
drop policy if exists "crm_insert_attachments" on crm.attachments;
drop policy if exists "crm_update_attachments" on crm.attachments;
drop policy if exists "crm_delete_attachments" on crm.attachments;
drop policy if exists "crm_read_custom_field_values" on crm.custom_field_values;
drop policy if exists "crm_insert_custom_field_values" on crm.custom_field_values;
drop policy if exists "crm_update_custom_field_values" on crm.custom_field_values;
drop policy if exists "crm_delete_custom_field_values" on crm.custom_field_values;

create policy "crm_read_customers_v2" on crm.customers
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_customers_v2" on crm.customers
for insert to authenticated
with check (crm.is_tenant_member(tenant_id) and archived = false);

create policy "crm_update_customers_v2" on crm.customers
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id) and (archived = false or crm.is_manager_or_admin(tenant_id)));

create policy "crm_delete_customers_v2" on crm.customers
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_leads_v2" on crm.leads
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_leads_v2" on crm.leads
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_leads_v2" on crm.leads
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_leads_v2" on crm.leads
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_customer_assets_v2" on crm.customer_assets
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_customer_assets_v2" on crm.customer_assets
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_customer_assets_v2" on crm.customer_assets
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_customer_assets_v2" on crm.customer_assets
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_jobs_v2" on crm.jobs
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_jobs_v2" on crm.jobs
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_jobs_v2" on crm.jobs
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_jobs_v2" on crm.jobs
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_notes_v2" on crm.notes
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_notes_v2" on crm.notes
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_notes_v2" on crm.notes
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_notes_v2" on crm.notes
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_appointments_v2" on crm.appointments
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_appointments_v2" on crm.appointments
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_appointments_v2" on crm.appointments
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_appointments_v2" on crm.appointments
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_quotes_v2" on crm.quotes
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_quotes_v2" on crm.quotes
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_quotes_v2" on crm.quotes
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_quotes_v2" on crm.quotes
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_invoices_v2" on crm.invoices
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_invoices_v2" on crm.invoices
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_invoices_v2" on crm.invoices
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_invoices_v2" on crm.invoices
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_payments_v2" on crm.payments
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_payments_v2" on crm.payments
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_payments_v2" on crm.payments
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_payments_v2" on crm.payments
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_expenses_v2" on crm.expenses
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_expenses_v2" on crm.expenses
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_expenses_v2" on crm.expenses
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_expenses_v2" on crm.expenses
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_attachments_v2" on crm.attachments
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_attachments_v2" on crm.attachments
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_attachments_v2" on crm.attachments
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_attachments_v2" on crm.attachments
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_custom_field_values_v2" on crm.custom_field_values
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_custom_field_values_v2" on crm.custom_field_values
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_custom_field_values_v2" on crm.custom_field_values
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_custom_field_values_v2" on crm.custom_field_values
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
