create table if not exists crm.product_addons (
  id uuid primary key default gen_random_uuid(),
  addon_key text not null unique,
  enabled boolean not null default false,
  demo_enabled boolean not null default true,
  display_name text not null,
  price_label text not null,
  cta_url text,
  summary text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null unique,
  title text not null,
  subtitle text,
  channel text not null check (channel in ('sms', 'whatsapp', 'web_chat', 'voice')),
  customer_name text not null,
  customer_handle text not null,
  inbound_label text not null,
  summary text not null,
  final_outcome text not null,
  roi_metrics jsonb not null default '{}'::jsonb,
  extracted_entities jsonb not null default '{}'::jsonb,
  is_demo boolean not null default true,
  demo_scenario_key text not null default 'core-walkthrough',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references crm.ai_conversations(id) on delete cascade,
  sort_order integer not null,
  offset_seconds integer not null default 0,
  role text not null check (role in ('customer', 'assistant', 'system')),
  sender_label text not null,
  body text not null,
  channel text check (channel in ('sms', 'whatsapp', 'web_chat', 'voice')),
  is_demo boolean not null default true,
  demo_scenario_key text not null default 'core-walkthrough',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.ai_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references crm.ai_conversations(id) on delete cascade,
  sort_order integer not null,
  offset_seconds integer not null default 0,
  agent_type text not null check (agent_type in ('triage', 'qualification', 'booking', 'faq', 'escalation')),
  title text not null,
  detail text not null,
  status_label text not null,
  is_demo boolean not null default true,
  demo_scenario_key text not null default 'core-walkthrough',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.ai_crm_impacts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references crm.ai_conversations(id) on delete cascade,
  sort_order integer not null,
  offset_seconds integer not null default 0,
  impact_type text not null,
  title text not null,
  detail text not null,
  crm_entity_type text check (crm_entity_type in ('lead', 'customer', 'appointment', 'job', 'quote', 'invoice')),
  crm_entity_id uuid,
  route_path text,
  is_demo boolean not null default true,
  demo_scenario_key text not null default 'core-walkthrough',
  created_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists crm_product_addons_set_updated_at on crm.product_addons;
create trigger crm_product_addons_set_updated_at before update on crm.product_addons for each row execute procedure crm.set_updated_at();

create index if not exists crm_product_addons_key_idx on crm.product_addons (addon_key);
create index if not exists crm_ai_conversations_demo_idx on crm.ai_conversations (is_demo, demo_scenario_key, scenario_key);
create index if not exists crm_ai_messages_conversation_idx on crm.ai_messages (conversation_id, sort_order);
create index if not exists crm_ai_actions_conversation_idx on crm.ai_actions (conversation_id, sort_order);
create index if not exists crm_ai_impacts_conversation_idx on crm.ai_crm_impacts (conversation_id, sort_order);

alter table crm.product_addons enable row level security;
alter table crm.ai_conversations enable row level security;
alter table crm.ai_messages enable row level security;
alter table crm.ai_actions enable row level security;
alter table crm.ai_crm_impacts enable row level security;

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

create policy "crm_read_product_addons" on crm.product_addons for select to authenticated using (crm.is_active_user());
create policy "crm_manage_product_addons" on crm.product_addons for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_read_ai_conversations" on crm.ai_conversations for select to authenticated using (crm.is_active_user());
create policy "crm_manage_ai_conversations" on crm.ai_conversations for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_read_ai_messages" on crm.ai_messages for select to authenticated using (crm.is_active_user());
create policy "crm_manage_ai_messages" on crm.ai_messages for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_read_ai_actions" on crm.ai_actions for select to authenticated using (crm.is_active_user());
create policy "crm_manage_ai_actions" on crm.ai_actions for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());
create policy "crm_read_ai_crm_impacts" on crm.ai_crm_impacts for select to authenticated using (crm.is_active_user());
create policy "crm_manage_ai_crm_impacts" on crm.ai_crm_impacts for all to authenticated using (crm.is_manager_or_admin()) with check (crm.is_manager_or_admin());

insert into crm.product_addons (
  addon_key,
  enabled,
  demo_enabled,
  display_name,
  price_label,
  cta_url,
  summary
)
values (
  'ai_comms_hub',
  false,
  true,
  'AI Hub',
  'From GBP 299/mo per company',
  'https://customerjourneys.ai/en-GB/demo',
  'Turn missed calls, chats, and out-of-hours enquiries into qualified CRM activity automatically.'
)
on conflict (addon_key) do update
set
  demo_enabled = excluded.demo_enabled,
  display_name = excluded.display_name,
  price_label = excluded.price_label,
  cta_url = excluded.cta_url,
  summary = excluded.summary;

insert into crm.ai_conversations (
  id,
  scenario_key,
  title,
  subtitle,
  channel,
  customer_name,
  customer_handle,
  inbound_label,
  summary,
  final_outcome,
  roi_metrics,
  extracted_entities,
  is_demo,
  demo_scenario_key,
  created_at
)
values
  (
    '44444444-4444-4444-8444-444444444401',
    'missed-call-recovery',
    'Missed Call Recovery',
    'After-hours voice lead converted into a booked callback',
    'voice',
    'Daniel Brooks',
    '+44 7700 900901',
    'Missed call captured at 18:42',
    'AI follows up a missed evening call, qualifies the leak, and books a next-morning callback without admin intervention.',
    'Lead created, customer matched, callback appointment booked for 08:30, escalation note sent to on-call manager.',
    '{"missed_calls_recovered":14,"bookings_captured":6,"leads_qualified":19,"average_response_minutes":2}'::jsonb,
    '{"issue":"Kitchen sink leak","urgency":"Same evening concern, safe overnight","postcode":"UB8 2AA","preferred_time":"Tomorrow 08:30","outcome":"Callback booked"}'::jsonb,
    true,
    'core-walkthrough',
    '2026-03-22T18:42:00.000Z'
  ),
  (
    '44444444-4444-4444-8444-444444444402',
    'urgent-job-booking',
    'Urgent Job Booking',
    'WhatsApp enquiry turned into a booked emergency visit',
    'whatsapp',
    'Nadia Hussain',
    '+44 7700 900902',
    'WhatsApp emergency message at 07:14',
    'AI qualifies a burst pipe, collects the postcode, and books a same-day emergency visit while the office is still opening.',
    'Customer created, job booked, engineer dispatch note prepared, and the customer receives a confirmed arrival window.',
    '{"missed_calls_recovered":7,"bookings_captured":11,"leads_qualified":22,"average_response_minutes":1}'::jsonb,
    '{"issue":"Burst pipe under upstairs bathroom","urgency":"Emergency same day","postcode":"HA4 7DL","service":"Emergency plumbing","arrival_window":"10:00-12:00"}'::jsonb,
    true,
    'core-walkthrough',
    '2026-03-22T07:14:00.000Z'
  ),
  (
    '44444444-4444-4444-8444-444444444403',
    'quote-qualification',
    'Quote Qualification',
    'Web chat enquiry converted into a high-quality sales follow-up',
    'web_chat',
    'Ava Mercer',
    'Website visitor',
    'Website chat started from the boiler install page',
    'AI asks targeted boiler-install questions, captures the home details, and pushes a sales-ready lead into the CRM.',
    'Lead qualified, quote follow-up staged, and the sales team can open the linked customer, quote, and invoice demo records.',
    '{"missed_calls_recovered":5,"bookings_captured":4,"leads_qualified":27,"average_response_minutes":1}'::jsonb,
    '{"issue":"Boiler replacement quote","bedrooms":"3 bedroom house","fuel":"Mains gas","postcode":"SL0 9JT","budget_signal":"Wants finance options"}'::jsonb,
    true,
    'core-walkthrough',
    '2026-03-22T12:05:00.000Z'
  )
on conflict (id) do update
set
  scenario_key = excluded.scenario_key,
  title = excluded.title,
  subtitle = excluded.subtitle,
  channel = excluded.channel,
  customer_name = excluded.customer_name,
  customer_handle = excluded.customer_handle,
  inbound_label = excluded.inbound_label,
  summary = excluded.summary,
  final_outcome = excluded.final_outcome,
  roi_metrics = excluded.roi_metrics,
  extracted_entities = excluded.extracted_entities,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key,
  created_at = excluded.created_at;

insert into crm.ai_messages (
  id,
  conversation_id,
  sort_order,
  offset_seconds,
  role,
  sender_label,
  body,
  channel,
  is_demo,
  demo_scenario_key,
  created_at
)
values
  ('44444444-4444-4444-8444-444444444411','44444444-4444-4444-8444-444444444401',1,0,'system','Missed Call Event','Missed call received outside working hours from +44 7700 900901.','voice',true,'core-walkthrough','2026-03-22T18:42:00.000Z'),
  ('44444444-4444-4444-8444-444444444412','44444444-4444-4444-8444-444444444401',2,4,'assistant','AI SMS Follow-Up','Hi, this is Empire AI assistant. I noticed we missed your call. Tell me briefly what the plumbing issue is and I will help arrange the next step.','sms',true,'core-walkthrough','2026-03-22T18:42:04.000Z'),
  ('44444444-4444-4444-8444-444444444413','44444444-4444-4444-8444-444444444401',3,10,'customer','Daniel Brooks','Kitchen sink pipe is leaking under the cupboard. Not flooding yet but I need someone in the morning.','sms',true,'core-walkthrough','2026-03-22T18:42:10.000Z'),
  ('44444444-4444-4444-8444-444444444414','44444444-4444-4444-8444-444444444401',4,15,'assistant','AI SMS Follow-Up','Understood. Please confirm your postcode and best callback time tomorrow morning.','sms',true,'core-walkthrough','2026-03-22T18:42:15.000Z'),
  ('44444444-4444-4444-8444-444444444415','44444444-4444-4444-8444-444444444401',5,21,'customer','Daniel Brooks','UB8 2AA. 8:30 works.','sms',true,'core-walkthrough','2026-03-22T18:42:21.000Z'),
  ('44444444-4444-4444-8444-444444444416','44444444-4444-4444-8444-444444444401',6,27,'assistant','AI SMS Follow-Up','Thanks. I have booked a callback for 08:30 tomorrow and flagged the issue for the on-call plumbing manager.','sms',true,'core-walkthrough','2026-03-22T18:42:27.000Z'),
  ('44444444-4444-4444-8444-444444444441','44444444-4444-4444-8444-444444444402',1,0,'customer','Nadia Hussain','Hi, pipe has burst under our bathroom floor and water is coming through the ceiling. Need someone ASAP.','whatsapp',true,'core-walkthrough','2026-03-22T07:14:00.000Z'),
  ('44444444-4444-4444-8444-444444444442','44444444-4444-4444-8444-444444444402',2,5,'assistant','AI WhatsApp Agent','I can help. Please send your postcode and confirm whether the stop tap is already off.','whatsapp',true,'core-walkthrough','2026-03-22T07:14:05.000Z'),
  ('44444444-4444-4444-8444-444444444443','44444444-4444-4444-8444-444444444402',3,11,'customer','Nadia Hussain','HA4 7DL and yes the stop tap is off now.','whatsapp',true,'core-walkthrough','2026-03-22T07:14:11.000Z'),
  ('44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444402',4,17,'assistant','AI WhatsApp Agent','Thanks. I have marked this as an emergency plumbing job and reserved the 10:00-12:00 arrival window. A dispatcher will call if anything changes.','whatsapp',true,'core-walkthrough','2026-03-22T07:14:17.000Z'),
  ('44444444-4444-4444-8444-444444444471','44444444-4444-4444-8444-444444444403',1,0,'customer','Ava Mercer','Hi, I need a quote for replacing my boiler and want to know if finance is possible.','web_chat',true,'core-walkthrough','2026-03-22T12:05:00.000Z'),
  ('44444444-4444-4444-8444-444444444472','44444444-4444-4444-8444-444444444403',2,5,'assistant','AI Web Chat Agent','Absolutely. How many bedrooms are in the property, is it mains gas, and what postcode is the home in?','web_chat',true,'core-walkthrough','2026-03-22T12:05:05.000Z'),
  ('44444444-4444-4444-8444-444444444473','44444444-4444-4444-8444-444444444403',3,11,'customer','Ava Mercer','3 bedrooms, mains gas, SL0 9JT.','web_chat',true,'core-walkthrough','2026-03-22T12:05:11.000Z'),
  ('44444444-4444-4444-8444-444444444474','44444444-4444-4444-8444-444444444403',4,16,'assistant','AI Web Chat Agent','Great. I have qualified this for the sales team, noted finance interest, and arranged a quote follow-up.','web_chat',true,'core-walkthrough','2026-03-22T12:05:16.000Z')
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sort_order = excluded.sort_order,
  offset_seconds = excluded.offset_seconds,
  role = excluded.role,
  sender_label = excluded.sender_label,
  body = excluded.body,
  channel = excluded.channel,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key,
  created_at = excluded.created_at;

insert into crm.ai_actions (
  id,
  conversation_id,
  sort_order,
  offset_seconds,
  agent_type,
  title,
  detail,
  status_label,
  is_demo,
  demo_scenario_key,
  created_at
)
values
  ('44444444-4444-4444-8444-444444444421','44444444-4444-4444-8444-444444444401',1,2,'triage','Voice event routed into missed-call recovery','The assistant detected an after-hours missed call and immediately opened an SMS recovery flow.','triage complete',true,'core-walkthrough','2026-03-22T18:42:02.000Z'),
  ('44444444-4444-4444-8444-444444444422','44444444-4444-4444-8444-444444444401',2,12,'qualification','Leak assessed as urgent next-day callback','AI extracted issue type, urgency, and safe overnight handling from the customer''s reply.','facts extracted',true,'core-walkthrough','2026-03-22T18:42:12.000Z'),
  ('44444444-4444-4444-8444-444444444423','44444444-4444-4444-8444-444444444401',3,24,'booking','Callback slot reserved','The morning callback was selected and the team was notified with the captured issue summary.','booking staged',true,'core-walkthrough','2026-03-22T18:42:24.000Z'),
  ('44444444-4444-4444-8444-444444444424','44444444-4444-4444-8444-444444444401',4,30,'escalation','On-call manager informed','An escalation note was sent because the event originated from an after-hours missed call.','staff alerted',true,'core-walkthrough','2026-03-22T18:42:30.000Z'),
  ('44444444-4444-4444-8444-444444444451','44444444-4444-4444-8444-444444444402',1,2,'triage','Emergency intent detected','The assistant routed the conversation directly into the urgent booking path from the first message.','priority route',true,'core-walkthrough','2026-03-22T07:14:02.000Z'),
  ('44444444-4444-4444-8444-444444444452','44444444-4444-4444-8444-444444444402',2,12,'qualification','Risk and postcode captured','Stop-tap status, postcode, and service type were extracted into structured CRM fields.','qualified',true,'core-walkthrough','2026-03-22T07:14:12.000Z'),
  ('44444444-4444-4444-8444-444444444453','44444444-4444-4444-8444-444444444402',3,18,'booking','Emergency window booked','The demo shows the assistant committing the customer to the first suitable arrival window.','visit booked',true,'core-walkthrough','2026-03-22T07:14:18.000Z'),
  ('44444444-4444-4444-8444-444444444481','44444444-4444-4444-8444-444444444403',1,2,'triage','Sales intent routed to quote qualification','The web chat was recognized as a high-value boiler replacement enquiry rather than a generic FAQ.','routed',true,'core-walkthrough','2026-03-22T12:05:02.000Z'),
  ('44444444-4444-4444-8444-444444444482','44444444-4444-4444-8444-444444444403',2,12,'qualification','Property and finance signals captured','Bedrooms, fuel type, postcode, and finance intent were added to the lead summary.','qualified',true,'core-walkthrough','2026-03-22T12:05:12.000Z'),
  ('44444444-4444-4444-8444-444444444483','44444444-4444-4444-8444-444444444403',3,17,'faq','Finance question answered','The assistant answered the finance question inline while still progressing the lead toward human follow-up.','faq answered',true,'core-walkthrough','2026-03-22T12:05:17.000Z')
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sort_order = excluded.sort_order,
  offset_seconds = excluded.offset_seconds,
  agent_type = excluded.agent_type,
  title = excluded.title,
  detail = excluded.detail,
  status_label = excluded.status_label,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key,
  created_at = excluded.created_at;

insert into crm.ai_crm_impacts (
  id,
  conversation_id,
  sort_order,
  offset_seconds,
  impact_type,
  title,
  detail,
  crm_entity_type,
  crm_entity_id,
  route_path,
  is_demo,
  demo_scenario_key,
  created_at
)
values
  ('44444444-4444-4444-8444-444444444431','44444444-4444-4444-8444-444444444401',1,13,'lead_created','Lead created','A plumbing lead was added automatically with the issue summary and callback target time.','lead','11111111-1111-4111-8111-111111111112','/leads',true,'core-walkthrough','2026-03-22T18:42:13.000Z'),
  ('44444444-4444-4444-8444-444444444432','44444444-4444-4444-8444-444444444401',2,16,'customer_matched','Customer matched','The enquiry was matched into the existing demo customer profile for fast follow-up.','customer','11111111-1111-4111-8111-111111111111','/customers/11111111-1111-4111-8111-111111111111',true,'core-walkthrough','2026-03-22T18:42:16.000Z'),
  ('44444444-4444-4444-8444-444444444433','44444444-4444-4444-8444-444444444401',3,26,'appointment_booked','Callback appointment booked','A callback slot was scheduled and surfaced to the operations calendar.','appointment',null,'/calendar',true,'core-walkthrough','2026-03-22T18:42:26.000Z'),
  ('44444444-4444-4444-8444-444444444461','44444444-4444-4444-8444-444444444402',1,13,'customer_created','Customer created','A new customer profile is created instantly from the WhatsApp thread.','customer','11111111-1111-4111-8111-111111111111','/customers/11111111-1111-4111-8111-111111111111',true,'core-walkthrough','2026-03-22T07:14:13.000Z'),
  ('44444444-4444-4444-8444-444444444462','44444444-4444-4444-8444-444444444402',2,19,'job_created','Emergency job booked','Operations gets a booked emergency job with the arrival window and issue summary attached.','job','11111111-1111-4111-8111-111111111114','/jobs/11111111-1111-4111-8111-111111111114',true,'core-walkthrough','2026-03-22T07:14:19.000Z'),
  ('44444444-4444-4444-8444-444444444463','44444444-4444-4444-8444-444444444402',3,21,'follow_up_scheduled','Dispatcher follow-up staged','A follow-up reminder is queued so the team can confirm ETA if the morning schedule changes.','appointment',null,'/calendar',true,'core-walkthrough','2026-03-22T07:14:21.000Z'),
  ('44444444-4444-4444-8444-444444444491','44444444-4444-4444-8444-444444444403',1,13,'lead_created','Qualified lead created','The sales team receives a complete lead instead of an unstructured chat transcript.','lead','11111111-1111-4111-8111-111111111112','/leads',true,'core-walkthrough','2026-03-22T12:05:13.000Z'),
  ('44444444-4444-4444-8444-444444444492','44444444-4444-4444-8444-444444444403',2,18,'quote_follow_up','Quote workflow linked','The demo customer can be opened straight into the quote and invoice history used elsewhere in the CRM walkthrough.','quote','11111111-1111-4111-8111-111111111117','/quotes/11111111-1111-4111-8111-111111111117',true,'core-walkthrough','2026-03-22T12:05:18.000Z'),
  ('44444444-4444-4444-8444-444444444493','44444444-4444-4444-8444-444444444403',3,20,'invoice_context_ready','Commercial context visible','The invoicing path is already connected, making the add-on story feel tied to revenue rather than just chat.','invoice','11111111-1111-4111-8111-111111111118','/invoices/11111111-1111-4111-8111-111111111118',true,'core-walkthrough','2026-03-22T12:05:20.000Z')
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sort_order = excluded.sort_order,
  offset_seconds = excluded.offset_seconds,
  impact_type = excluded.impact_type,
  title = excluded.title,
  detail = excluded.detail,
  crm_entity_type = excluded.crm_entity_type,
  crm_entity_id = excluded.crm_entity_id,
  route_path = excluded.route_path,
  is_demo = excluded.is_demo,
  demo_scenario_key = excluded.demo_scenario_key,
  created_at = excluded.created_at;
