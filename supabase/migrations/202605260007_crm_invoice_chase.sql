alter table crm.customers
  add column if not exists requires_call boolean not null default false;

create index if not exists crm_customers_requires_call_idx
  on crm.customers (tenant_id, requires_call)
  where requires_call = true;

insert into crm.notification_templates (tenant_id, key, channel, locale, subject, body, variables, active)
values
  (
    null,
    'invoice_overdue_7d',
    'email',
    'en-GB',
    'Reminder: invoice {{invoice_number}} is overdue',
    '<p>Hi {{customer_name}},</p><p>This is a quick reminder that invoice {{invoice_number}} is still outstanding.</p><p>You can review it here: {{payment_link}}</p><p>If you have any questions, contact us at {{contact_route}}.</p>',
    '["customer_name","invoice_number","payment_link","contact_route"]'::jsonb,
    true
  ),
  (
    null,
    'invoice_overdue_14d',
    'email',
    'en-GB',
    'Invoice {{invoice_number}} remains outstanding',
    '<p>Hi {{customer_name}},</p><p>Invoice {{invoice_number}} remains unpaid. Please arrange payment or contact us at {{contact_route}} if anything is unclear.</p><p>{{payment_link}}</p>',
    '["customer_name","invoice_number","payment_link","contact_route"]'::jsonb,
    true
  ),
  (
    null,
    'invoice_overdue_21d_final',
    'email',
    'en-GB',
    'Final reminder: invoice {{invoice_number}}',
    '<p>Hi {{customer_name}},</p><p>This is the final automated reminder for invoice {{invoice_number}}. Please contact us at {{contact_route}} so we can resolve this.</p><p>{{payment_link}}</p>',
    '["customer_name","invoice_number","payment_link","contact_route"]'::jsonb,
    true
  )
on conflict (key, channel, locale) where tenant_id is null do update
set subject = excluded.subject,
    body = excluded.body,
    variables = excluded.variables,
    active = excluded.active;

update crm.notification_templates
set body = '<p>Hi {{customer_name}},</p><p>Invoice {{invoice_number}} is now due. You can review it here: {{payment_link}}</p><p>If you have any questions, contact us at {{contact_route}}.</p>',
    variables = '["customer_name","invoice_number","payment_link","contact_route"]'::jsonb
where tenant_id is null
  and key = 'invoice_overdue_0d'
  and channel = 'email'
  and locale = 'en-GB';
