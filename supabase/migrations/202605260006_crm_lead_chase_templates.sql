insert into crm.notification_templates (tenant_id, key, channel, locale, subject, body, variables, active)
values
  (
    null,
    'lead_chase_3d',
    'sms',
    'en-GB',
    null,
    'Hi {{customer_name}}, just checking whether you still need help with {{service_name}}. Reply here and we can get you booked in. STOP to opt out.',
    '["customer_name","service_name"]'::jsonb,
    true
  )
on conflict (key, channel, locale) where tenant_id is null do update
set body = excluded.body,
    variables = excluded.variables,
    active = excluded.active;
