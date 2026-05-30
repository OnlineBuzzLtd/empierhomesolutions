alter table crm.tenant_settings
  add column if not exists trade_vertical text not null default 'general_trades',
  add column if not exists ai_catalog_default_duration_minutes integer not null default 60,
  add column if not exists ai_catalog_emergency_duration_minutes integer not null default 120,
  add column if not exists ai_catalog_can_give_fixed_prices boolean not null default false,
  add column if not exists ai_catalog_can_give_from_prices boolean not null default true,
  add column if not exists ai_catalog_requires_office_quote_for_installations boolean not null default true,
  add column if not exists ai_catalog_price_disclaimer text not null default 'The office confirms final pricing before work starts.',
  add column if not exists ai_catalog_emergency_escalation_text text not null default 'If there is an immediate risk to safety or property, call the emergency services or shut off the relevant supply before waiting for a callback.',
  add column if not exists ai_catalog_gas_safety_text text,
  add column if not exists ai_catalog_electrical_safety_text text;

alter table crm.tenant_settings
  drop constraint if exists crm_tenant_settings_trade_vertical_check;

alter table crm.tenant_settings
  add constraint crm_tenant_settings_trade_vertical_check
  check (trade_vertical in (
    'plumbing',
    'heating',
    'electrical',
    'drainage',
    'roofing',
    'cleaning',
    'pest_control',
    'locksmith',
    'general_trades'
  ));

alter table crm.tenant_settings
  drop constraint if exists crm_tenant_settings_ai_catalog_duration_check;

alter table crm.tenant_settings
  add constraint crm_tenant_settings_ai_catalog_duration_check
  check (
    ai_catalog_default_duration_minutes > 0
    and ai_catalog_emergency_duration_minutes > 0
  );

alter table crm.services
  add column if not exists ai_visible boolean not null default true,
  add column if not exists ai_bookable boolean not null default true,
  add column if not exists ai_price_enabled boolean not null default false,
  add column if not exists ai_requires_office_quote boolean not null default true,
  add column if not exists ai_default_duration_minutes integer,
  add column if not exists ai_price_disclaimer text;

alter table crm.services
  drop constraint if exists crm_services_ai_default_duration_check;

alter table crm.services
  add constraint crm_services_ai_default_duration_check
  check (ai_default_duration_minutes is null or ai_default_duration_minutes > 0);

alter table crm.job_types
  add column if not exists ai_visible boolean not null default true,
  add column if not exists ai_bookable boolean not null default true,
  add column if not exists ai_default_duration_minutes integer;

alter table crm.job_types
  drop constraint if exists crm_job_types_ai_default_duration_check;

alter table crm.job_types
  add constraint crm_job_types_ai_default_duration_check
  check (ai_default_duration_minutes is null or ai_default_duration_minutes > 0);

alter table crm.packages
  add column if not exists service_id uuid references crm.services(id) on delete set null,
  add column if not exists ai_visible boolean not null default true,
  add column if not exists ai_bookable boolean not null default false,
  add column if not exists ai_price_enabled boolean not null default false,
  add column if not exists ai_requires_office_quote boolean not null default true,
  add column if not exists ai_default_duration_minutes integer,
  add column if not exists ai_price_disclaimer text;

alter table crm.packages
  drop constraint if exists crm_packages_ai_default_duration_check;

alter table crm.packages
  add constraint crm_packages_ai_default_duration_check
  check (ai_default_duration_minutes is null or ai_default_duration_minutes > 0);

create index if not exists crm_services_tenant_ai_idx
  on crm.services (tenant_id, active, ai_visible, name);

create index if not exists crm_job_types_tenant_ai_idx
  on crm.job_types (tenant_id, service_id, active, ai_visible, name);

create index if not exists crm_packages_tenant_ai_idx
  on crm.packages (tenant_id, is_active, ai_visible, name);
