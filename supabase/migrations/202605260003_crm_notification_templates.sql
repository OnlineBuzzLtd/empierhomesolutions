create table if not exists crm.notification_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references crm.tenants(id) on delete cascade,
  key text not null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  locale text not null default 'en-GB',
  subject text,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_notification_templates_set_updated_at
before update on crm.notification_templates
for each row execute procedure crm.set_updated_at();

create unique index if not exists crm_notification_templates_default_unique_idx
  on crm.notification_templates (key, channel, locale)
  where tenant_id is null;

create unique index if not exists crm_notification_templates_tenant_unique_idx
  on crm.notification_templates (tenant_id, key, channel, locale)
  where tenant_id is not null;

create index if not exists crm_notification_templates_tenant_active_idx
  on crm.notification_templates (tenant_id, active, key, channel);

alter table crm.notification_templates enable row level security;

create policy "crm_read_notification_templates" on crm.notification_templates
for select to authenticated
using (tenant_id is null or crm.is_tenant_member(tenant_id));

create policy "crm_insert_notification_templates" on crm.notification_templates
for insert to authenticated
with check (tenant_id is not null and crm.is_manager_or_admin(tenant_id));

create policy "crm_update_notification_templates" on crm.notification_templates
for update to authenticated
using (tenant_id is not null and crm.is_manager_or_admin(tenant_id))
with check (tenant_id is not null and crm.is_manager_or_admin(tenant_id));

create policy "crm_delete_notification_templates" on crm.notification_templates
for delete to authenticated
using (tenant_id is not null and crm.is_manager_or_admin(tenant_id));

insert into crm.notification_templates (tenant_id, key, channel, locale, subject, body, variables)
values
  (null, 'confirmation_sms', 'sms', 'en-GB', null, 'Hi {{customer_name}}, your {{service_name}} booking is confirmed for {{appointment_time}}. Reply STOP to opt out.', '["customer_name","service_name","appointment_time"]'::jsonb),
  (null, 'confirmation_email', 'email', 'en-GB', 'Booking confirmed for {{appointment_time}}', '<p>Hi {{customer_name}},</p><p>Your {{service_name}} booking is confirmed for {{appointment_time}}.</p>', '["customer_name","service_name","appointment_time"]'::jsonb),
  (null, 'reminder_24h_sms', 'sms', 'en-GB', null, 'Reminder: {{service_name}} is booked for {{appointment_time}}. Reply if anything has changed. STOP to opt out.', '["service_name","appointment_time"]'::jsonb),
  (null, 'reminder_24h_email', 'email', 'en-GB', 'Reminder: {{service_name}} on {{appointment_time}}', '<p>Hi {{customer_name}},</p><p>This is a reminder that {{service_name}} is booked for {{appointment_time}}.</p>', '["customer_name","service_name","appointment_time"]'::jsonb),
  (null, 'reminder_2h_sms', 'sms', 'en-GB', null, 'Your engineer is due today around {{appointment_time}}. Reply if access details have changed. STOP to opt out.', '["appointment_time"]'::jsonb),
  (null, 'en_route_sms', 'sms', 'en-GB', null, 'Your engineer is on the way now. Reply here if there are any access notes. STOP to opt out.', '[]'::jsonb),
  (null, 'quote_chase_3d', 'sms', 'en-GB', null, 'Hi {{customer_name}}, just checking whether you had any questions about quote {{quote_number}}. STOP to opt out.', '["customer_name","quote_number"]'::jsonb),
  (null, 'lead_chase_24h', 'sms', 'en-GB', null, 'Hi {{customer_name}}, do you still need help with {{service_name}}? We can still get you booked in. STOP to opt out.', '["customer_name","service_name"]'::jsonb),
  (null, 'invoice_overdue_0d', 'email', 'en-GB', 'Invoice {{invoice_number}} is due', '<p>Hi {{customer_name}},</p><p>Invoice {{invoice_number}} is now due. You can pay here: {{payment_link}}</p>', '["customer_name","invoice_number","payment_link"]'::jsonb),
  (null, 'review_request_sms', 'sms', 'en-GB', null, 'Thanks for choosing us, {{customer_name}}. How did we do? {{feedback_link}} STOP to opt out.', '["customer_name","feedback_link"]'::jsonb)
on conflict do nothing;
