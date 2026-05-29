do $$
begin
  create type crm.lead_source_t as enum (
    'webchat',
    'voice',
    'sms',
    'whatsapp',
    'email',
    'landing_form',
    'google_lead',
    'meta_lead',
    'manual',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

alter table crm.leads
  add column if not exists source_enum crm.lead_source_t not null default 'manual',
  add column if not exists lead_attribution jsonb not null default '{}'::jsonb;

alter table crm.customers
  add column if not exists source_enum crm.lead_source_t not null default 'manual';

update crm.leads
set source_enum = case
  when lower(coalesce(source, '')) in ('webchat', 'chat') then 'webchat'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('voice', 'phone', 'call') then 'voice'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('sms', 'text') then 'sms'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('whatsapp', 'wa') then 'whatsapp'::crm.lead_source_t
  when lower(coalesce(source, '')) = 'email' then 'email'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('landing_form', 'form', 'website', 'web') then 'landing_form'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('google', 'google_lead', 'google lead') then 'google_lead'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('meta', 'facebook', 'meta_lead', 'facebook lead') then 'meta_lead'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('manual', '') then 'manual'::crm.lead_source_t
  else 'other'::crm.lead_source_t
end;

update crm.customers
set source_enum = case
  when lower(coalesce(source, '')) in ('webchat', 'chat') then 'webchat'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('voice', 'phone', 'call') then 'voice'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('sms', 'text') then 'sms'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('whatsapp', 'wa') then 'whatsapp'::crm.lead_source_t
  when lower(coalesce(source, '')) = 'email' then 'email'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('landing_form', 'form', 'website', 'web') then 'landing_form'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('google', 'google_lead', 'google lead') then 'google_lead'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('meta', 'facebook', 'meta_lead', 'facebook lead') then 'meta_lead'::crm.lead_source_t
  when lower(coalesce(source, '')) in ('manual', '') then 'manual'::crm.lead_source_t
  else 'other'::crm.lead_source_t
end;

create index if not exists crm_leads_source_enum_idx
  on crm.leads (tenant_id, source_enum, created_at desc);

create index if not exists crm_customers_source_enum_idx
  on crm.customers (tenant_id, source_enum, created_at desc);
