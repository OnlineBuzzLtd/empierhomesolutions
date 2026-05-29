alter table crm.leads
  add column if not exists re_engaged_at timestamptz;

alter table crm.tenant_settings
  add column if not exists lost_lead_reengagement_enabled boolean not null default true;

create index if not exists crm_leads_lost_reengagement_due_idx
  on crm.leads (tenant_id, created_at)
  where status = 'lost' and re_engaged_at is null;

insert into crm.notification_templates (tenant_id, key, channel, locale, subject, body, variables, active)
values
  (
    null,
    'lost_lead_reengage_90d',
    'sms',
    'en-GB',
    null,
    'Hi {{customer_name}}, checking in from {{business_name}}. Do you still need help with {{service_name}}? Reply here if we can help. STOP to opt out.',
    '["customer_name","business_name","service_name"]'::jsonb,
    true
  )
on conflict (key, channel, locale) where tenant_id is null do update
set body = excluded.body,
    variables = excluded.variables,
    active = excluded.active;
