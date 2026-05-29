alter table crm.tenant_settings
  add column if not exists fsm_provider text not null default 'none',
  add column if not exists fsm_config jsonb not null default '{}'::jsonb,
  add column if not exists payment_primary_provider text not null default 'none',
  add column if not exists stripe_account_id text,
  add column if not exists gocardless_merchant_id text;

alter table crm.tenant_settings
  drop constraint if exists crm_tenant_settings_fsm_provider_check;

alter table crm.tenant_settings
  add constraint crm_tenant_settings_fsm_provider_check
  check (fsm_provider in ('none', 'servicem8', 'joblogic'));

alter table crm.tenant_settings
  drop constraint if exists crm_tenant_settings_payment_primary_provider_check;

alter table crm.tenant_settings
  add constraint crm_tenant_settings_payment_primary_provider_check
  check (payment_primary_provider in ('none', 'stripe', 'gocardless'));

alter table crm.appointments
  add column if not exists external_fsm_id text,
  add column if not exists external_fsm_provider text;

create index if not exists crm_appointments_external_fsm_idx
  on crm.appointments (tenant_id, external_fsm_provider, external_fsm_id)
  where external_fsm_id is not null;
