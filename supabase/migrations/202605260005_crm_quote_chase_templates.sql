insert into crm.notification_templates (tenant_id, key, channel, locale, subject, body, variables, active)
values
  (
    null,
    'quote_chase_7d',
    'sms',
    'en-GB',
    null,
    'Hi {{customer_name}}, just checking whether you had any questions on quote {{quote_number}} for {{quote_total}}. You can view it here: {{quote_url}} STOP to opt out.',
    '["customer_name","quote_number","quote_total","quote_url"]'::jsonb,
    true
  ),
  (
    null,
    'quote_chase_14d',
    'sms',
    'en-GB',
    null,
    'Hi {{customer_name}}, final check-in on quote {{quote_number}}. If you would like us to book the work in, reply here or use {{quote_url}} STOP to opt out.',
    '["customer_name","quote_number","quote_url"]'::jsonb,
    true
  )
on conflict (key, channel, locale) where tenant_id is null do update
set body = excluded.body,
    variables = excluded.variables,
    active = excluded.active;
