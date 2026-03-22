alter table crm.customers add column if not exists is_demo boolean not null default false;
alter table crm.customers add column if not exists demo_scenario_key text;

alter table crm.leads add column if not exists is_demo boolean not null default false;
alter table crm.leads add column if not exists demo_scenario_key text;

alter table crm.customer_assets add column if not exists is_demo boolean not null default false;
alter table crm.customer_assets add column if not exists demo_scenario_key text;

alter table crm.jobs add column if not exists is_demo boolean not null default false;
alter table crm.jobs add column if not exists demo_scenario_key text;

alter table crm.appointments add column if not exists is_demo boolean not null default false;
alter table crm.appointments add column if not exists demo_scenario_key text;

alter table crm.quotes add column if not exists is_demo boolean not null default false;
alter table crm.quotes add column if not exists demo_scenario_key text;

alter table crm.invoices add column if not exists is_demo boolean not null default false;
alter table crm.invoices add column if not exists demo_scenario_key text;

alter table crm.payments add column if not exists is_demo boolean not null default false;
alter table crm.payments add column if not exists demo_scenario_key text;

alter table crm.expenses add column if not exists is_demo boolean not null default false;
alter table crm.expenses add column if not exists demo_scenario_key text;

alter table crm.attachments add column if not exists is_demo boolean not null default false;
alter table crm.attachments add column if not exists demo_scenario_key text;

alter table crm.notes add column if not exists is_demo boolean not null default false;
alter table crm.notes add column if not exists demo_scenario_key text;

alter table crm.suppliers add column if not exists is_demo boolean not null default false;
alter table crm.suppliers add column if not exists demo_scenario_key text;

alter table crm.products add column if not exists is_demo boolean not null default false;
alter table crm.products add column if not exists demo_scenario_key text;

alter table crm.quote_templates add column if not exists is_demo boolean not null default false;
alter table crm.quote_templates add column if not exists demo_scenario_key text;

alter table crm.user_profiles add column if not exists is_demo boolean not null default false;
alter table crm.user_profiles add column if not exists demo_scenario_key text;

alter table crm.user_certifications add column if not exists is_demo boolean not null default false;
alter table crm.user_certifications add column if not exists demo_scenario_key text;

create index if not exists crm_customers_demo_idx on crm.customers (is_demo, demo_scenario_key);
create index if not exists crm_leads_demo_idx on crm.leads (is_demo, demo_scenario_key);
create index if not exists crm_customer_assets_demo_idx on crm.customer_assets (is_demo, demo_scenario_key);
create index if not exists crm_jobs_demo_idx on crm.jobs (is_demo, demo_scenario_key);
create index if not exists crm_appointments_demo_idx on crm.appointments (is_demo, demo_scenario_key);
create index if not exists crm_quotes_demo_idx on crm.quotes (is_demo, demo_scenario_key);
create index if not exists crm_invoices_demo_idx on crm.invoices (is_demo, demo_scenario_key);
create index if not exists crm_payments_demo_idx on crm.payments (is_demo, demo_scenario_key);
create index if not exists crm_expenses_demo_idx on crm.expenses (is_demo, demo_scenario_key);
create index if not exists crm_attachments_demo_idx on crm.attachments (is_demo, demo_scenario_key);
create index if not exists crm_notes_demo_idx on crm.notes (is_demo, demo_scenario_key);
create index if not exists crm_suppliers_demo_idx on crm.suppliers (is_demo, demo_scenario_key);
create index if not exists crm_products_demo_idx on crm.products (is_demo, demo_scenario_key);
create index if not exists crm_quote_templates_demo_idx on crm.quote_templates (is_demo, demo_scenario_key);
create index if not exists crm_user_profiles_demo_idx on crm.user_profiles (is_demo, demo_scenario_key);
create index if not exists crm_user_certifications_demo_idx on crm.user_certifications (is_demo, demo_scenario_key);

with service_map as (
  select id, slug
  from crm.services
),
job_type_map as (
  select jt.id, jt.slug, s.slug as service_slug
  from crm.job_types jt
  join crm.services s on s.id = jt.service_id
)
insert into crm.customers (
  id,
  full_name,
  phone,
  email,
  address_line1,
  city,
  postcode,
  property_type,
  occupancy_type,
  source,
  referral_notes,
  notes,
  archived,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Sarah Thompson',
  '07700111222',
  'sarah.thompson@example.com',
  '18 Orchard Lane',
  'Uxbridge',
  'UB8 2AA',
  'Semi-detached',
  'Owner occupied',
  'Google Ads',
  'Requested a clean walkthrough example for sales training.',
  'Demo household for the CRM walkthrough. Boiler replacement quoted and invoice raised.',
  false,
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  phone = excluded.phone,
  email = excluded.email,
  address_line1 = excluded.address_line1,
  city = excluded.city,
  postcode = excluded.postcode,
  property_type = excluded.property_type,
  occupancy_type = excluded.occupancy_type,
  source = excluded.source,
  referral_notes = excluded.referral_notes,
  notes = excluded.notes,
  archived = excluded.archived,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

with service_map as (
  select id, slug
  from crm.services
),
job_type_map as (
  select jt.id, jt.slug, s.slug as service_slug
  from crm.job_types jt
  join crm.services s on s.id = jt.service_id
)
insert into crm.leads (
  id,
  customer_id,
  service_id,
  job_type_id,
  status,
  lost_reason,
  source,
  assigned_to,
  next_action_at,
  notes,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111112',
  '11111111-1111-4111-8111-111111111111',
  (select id from service_map where slug = 'boilers'),
  (select id from job_type_map where slug = 'boiler-install' and service_slug = 'boilers'),
  'follow_up',
  null,
  'Google Ads',
  null,
  date_trunc('hour', timezone('utc', now()) + interval '1 day'),
  'Customer requested a morning callback and a written quote comparison.',
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  customer_id = excluded.customer_id,
  service_id = excluded.service_id,
  job_type_id = excluded.job_type_id,
  status = excluded.status,
  lost_reason = excluded.lost_reason,
  source = excluded.source,
  next_action_at = excluded.next_action_at,
  notes = excluded.notes,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

with service_map as (
  select id, slug
  from crm.services
)
insert into crm.customer_assets (
  id,
  customer_id,
  service_id,
  asset_type,
  make,
  model,
  serial_number,
  install_date,
  service_due_date,
  warranty_end_date,
  cylinder_type,
  notes,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111113',
  '11111111-1111-4111-8111-111111111111',
  (select id from service_map where slug = 'boilers'),
  'Combi Boiler',
  'Vaillant',
  'ecoTEC Plus 832',
  'VT-DEMO-832',
  current_date - 180,
  current_date + 14,
  current_date + 180,
  null,
  'Installed system used to drive service due and warranty reminder examples.',
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  customer_id = excluded.customer_id,
  service_id = excluded.service_id,
  asset_type = excluded.asset_type,
  make = excluded.make,
  model = excluded.model,
  serial_number = excluded.serial_number,
  install_date = excluded.install_date,
  service_due_date = excluded.service_due_date,
  warranty_end_date = excluded.warranty_end_date,
  cylinder_type = excluded.cylinder_type,
  notes = excluded.notes,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

with service_map as (
  select id, slug
  from crm.services
),
job_type_map as (
  select jt.id, jt.slug, s.slug as service_slug
  from crm.job_types jt
  join crm.services s on s.id = jt.service_id
)
insert into crm.jobs (
  id,
  customer_id,
  lead_id,
  service_id,
  job_type_id,
  title,
  description,
  scheduled_date,
  scheduled_time,
  duration_hours,
  status,
  assigned_engineer,
  created_by,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111114',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111112',
  (select id from service_map where slug = 'boilers'),
  (select id from job_type_map where slug = 'boiler-install' and service_slug = 'boilers'),
  'Demo boiler replacement',
  'Replace ageing combi boiler, add magnetic filter, and commission the new setup.',
  current_date + 2,
  '09:30',
  4,
  'booked',
  'Demo Engineer',
  null,
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  customer_id = excluded.customer_id,
  lead_id = excluded.lead_id,
  service_id = excluded.service_id,
  job_type_id = excluded.job_type_id,
  title = excluded.title,
  description = excluded.description,
  scheduled_date = excluded.scheduled_date,
  scheduled_time = excluded.scheduled_time,
  duration_hours = excluded.duration_hours,
  status = excluded.status,
  assigned_engineer = excluded.assigned_engineer,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

insert into crm.notes (
  id,
  entity_type,
  entity_id,
  body,
  created_by,
  is_demo,
  demo_scenario_key
)
values
  (
    '11111111-1111-4111-8111-111111111115',
    'customer',
    '11111111-1111-4111-8111-111111111111',
    'Customer prefers morning visits and wants everything documented clearly for comparison.',
    null,
    true,
    'core-walkthrough'
  ),
  (
    '11111111-1111-4111-8111-111111111116',
    'job',
    '11111111-1111-4111-8111-111111111114',
    'Site visit booked with engineer. Existing boiler location confirmed and electrical spur already present.',
    null,
    true,
    'core-walkthrough'
  ),
  (
    '11111111-1111-4111-8111-111111111117',
    'lead',
    '11111111-1111-4111-8111-111111111112',
    'Follow-up needed to confirm finance preference and preferred install window.',
    null,
    true,
    'core-walkthrough'
  )
on conflict (id) do update
set
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  body = excluded.body,
  created_by = excluded.created_by,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

insert into crm.appointments (
  id,
  customer_id,
  lead_id,
  job_id,
  assigned_to,
  type,
  title,
  starts_at,
  ends_at,
  status,
  reminder_offset_minutes,
  recurrence_rule,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111118',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111112',
  '11111111-1111-4111-8111-111111111114',
  null,
  'survey',
  'Demo survey visit',
  date_trunc('day', timezone('utc', now())) + interval '1 day 09:00',
  date_trunc('day', timezone('utc', now())) + interval '1 day 10:00',
  'scheduled',
  60,
  'weekly',
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  customer_id = excluded.customer_id,
  lead_id = excluded.lead_id,
  job_id = excluded.job_id,
  type = excluded.type,
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  reminder_offset_minutes = excluded.reminder_offset_minutes,
  recurrence_rule = excluded.recurrence_rule,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

insert into crm.quotes (
  id,
  job_id,
  customer_id,
  quote_number,
  line_items,
  subtotal,
  vat_rate,
  vat_category,
  total,
  status,
  valid_until,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111119',
  '11111111-1111-4111-8111-111111111114',
  '11111111-1111-4111-8111-111111111111',
  'DEMO-QUOTE-0001',
  '[
    {"description":"Vaillant ecoTEC Plus 832","qty":1,"unit_price":2950},
    {"description":"Magnetic filter and system chemicals","qty":1,"unit_price":370}
  ]'::jsonb,
  3320,
  0.2,
  'standard_20',
  3984,
  'accepted',
  current_date + 21,
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  job_id = excluded.job_id,
  customer_id = excluded.customer_id,
  quote_number = excluded.quote_number,
  line_items = excluded.line_items,
  subtotal = excluded.subtotal,
  vat_rate = excluded.vat_rate,
  vat_category = excluded.vat_category,
  total = excluded.total,
  status = excluded.status,
  valid_until = excluded.valid_until,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

insert into crm.invoices (
  id,
  quote_id,
  job_id,
  customer_id,
  invoice_number,
  line_items,
  subtotal,
  vat_rate,
  vat_category,
  total,
  status,
  due_date,
  paid_at,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111120',
  '11111111-1111-4111-8111-111111111119',
  '11111111-1111-4111-8111-111111111114',
  '11111111-1111-4111-8111-111111111111',
  'DEMO-INV-0001',
  '[
    {"description":"Vaillant ecoTEC Plus 832","qty":1,"unit_price":2950},
    {"description":"Magnetic filter and system chemicals","qty":1,"unit_price":370}
  ]'::jsonb,
  3320,
  0.2,
  'standard_20',
  3984,
  'unpaid',
  current_date + 14,
  null,
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  quote_id = excluded.quote_id,
  job_id = excluded.job_id,
  customer_id = excluded.customer_id,
  invoice_number = excluded.invoice_number,
  line_items = excluded.line_items,
  subtotal = excluded.subtotal,
  vat_rate = excluded.vat_rate,
  vat_category = excluded.vat_category,
  total = excluded.total,
  status = excluded.status,
  due_date = excluded.due_date,
  paid_at = excluded.paid_at,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

insert into crm.payments (
  id,
  invoice_id,
  quote_id,
  customer_id,
  payment_type,
  amount,
  status,
  requested_at,
  received_at,
  reference,
  notes,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111121',
  '11111111-1111-4111-8111-111111111120',
  '11111111-1111-4111-8111-111111111119',
  '11111111-1111-4111-8111-111111111111',
  'deposit',
  750,
  'requested',
  timezone('utc', now()) - interval '2 days',
  null,
  'DEP-DEMO-0001',
  'Deposit request included in the walkthrough to show payment tracking.',
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  invoice_id = excluded.invoice_id,
  quote_id = excluded.quote_id,
  customer_id = excluded.customer_id,
  payment_type = excluded.payment_type,
  amount = excluded.amount,
  status = excluded.status,
  requested_at = excluded.requested_at,
  received_at = excluded.received_at,
  reference = excluded.reference,
  notes = excluded.notes,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

insert into crm.expenses (
  id,
  job_id,
  description,
  amount,
  category,
  receipt_url,
  created_by,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111122',
  '11111111-1111-4111-8111-111111111114',
  'Copper fittings and flue extension kit',
  265,
  'materials',
  null,
  null,
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  job_id = excluded.job_id,
  description = excluded.description,
  amount = excluded.amount,
  category = excluded.category,
  receipt_url = excluded.receipt_url,
  created_by = excluded.created_by,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

insert into crm.suppliers (
  id,
  name,
  category,
  contact_name,
  email,
  phone,
  pricing_last_updated_at,
  notes,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111123',
  'Wolseley Demo Trade Counter',
  'boilers',
  'Trade Desk',
  'trade-demo@example.com',
  '02070001111',
  timezone('utc', now()) - interval '7 days',
  'Demo supplier for quote-builder and catalog walkthroughs.',
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  name = excluded.name,
  category = excluded.category,
  contact_name = excluded.contact_name,
  email = excluded.email,
  phone = excluded.phone,
  pricing_last_updated_at = excluded.pricing_last_updated_at,
  notes = excluded.notes,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

with service_map as (
  select id, slug
  from crm.services
)
insert into crm.products (
  id,
  service_id,
  supplier_id,
  category,
  name,
  sku,
  unit_cost,
  markup_percent,
  sell_price,
  vat_category,
  active,
  is_demo,
  demo_scenario_key
)
values
  (
    '11111111-1111-4111-8111-111111111124',
    (select id from service_map where slug = 'boilers'),
    '11111111-1111-4111-8111-111111111123',
    'boiler',
    'Vaillant ecoTEC Plus 832',
    'VAIL-DEMO-832',
    2210,
    33.48,
    2950,
    'standard_20',
    true,
    true,
    'core-walkthrough'
  ),
  (
    '11111111-1111-4111-8111-111111111125',
    (select id from service_map where slug = 'boilers'),
    '11111111-1111-4111-8111-111111111123',
    'accessory',
    'Magnetic Filter',
    'MAG-DEMO-001',
    120,
    50,
    180,
    'standard_20',
    true,
    true,
    'core-walkthrough'
  )
on conflict (id) do update
set
  service_id = excluded.service_id,
  supplier_id = excluded.supplier_id,
  category = excluded.category,
  name = excluded.name,
  sku = excluded.sku,
  unit_cost = excluded.unit_cost,
  markup_percent = excluded.markup_percent,
  sell_price = excluded.sell_price,
  vat_category = excluded.vat_category,
  active = excluded.active,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;

with service_map as (
  select id, slug
  from crm.services
),
job_type_map as (
  select jt.id, jt.slug, s.slug as service_slug
  from crm.job_types jt
  join crm.services s on s.id = jt.service_id
)
insert into crm.quote_templates (
  id,
  service_id,
  job_type_id,
  name,
  description,
  line_items,
  optional_extras,
  payment_terms,
  active,
  is_demo,
  demo_scenario_key
)
values (
  '11111111-1111-4111-8111-111111111126',
  (select id from service_map where slug = 'boilers'),
  (select id from job_type_map where slug = 'boiler-install' and service_slug = 'boilers'),
  'Combi Boiler Replacement',
  'Reusable demo template showing how saved pricing turns into a live quote draft.',
  '[
    {"description":"Vaillant ecoTEC Plus 832","qty":1,"unit_price":2950},
    {"description":"Magnetic filter and system chemicals","qty":1,"unit_price":370}
  ]'::jsonb,
  '[
    {"description":"Wireless smart thermostat","qty":1,"unit_price":220},
    {"description":"Power flush add-on","qty":1,"unit_price":480}
  ]'::jsonb,
  '{"deposit":"25% on booking","balance":"On completion"}'::jsonb,
  true,
  true,
  'core-walkthrough'
)
on conflict (id) do update
set
  service_id = excluded.service_id,
  job_type_id = excluded.job_type_id,
  name = excluded.name,
  description = excluded.description,
  line_items = excluded.line_items,
  optional_extras = excluded.optional_extras,
  payment_terms = excluded.payment_terms,
  active = excluded.active,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key;
