create table if not exists crm.customer_promises (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade default crm.current_user_tenant_id(),
  customer_id uuid references crm.customers(id) on delete cascade,
  lead_id uuid references crm.leads(id) on delete set null,
  job_id uuid references crm.jobs(id) on delete set null,
  quote_id uuid references crm.quotes(id) on delete set null,
  invoice_id uuid references crm.invoices(id) on delete set null,
  platform_conversation_id text,
  platform_event_id uuid,
  promise_type text not null default 'follow_up' check (
    promise_type in ('callback', 'appointment', 'quote', 'invoice', 'follow_up', 'office_review', 'other')
  ),
  title text not null,
  detail text,
  owner_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  channel text not null default 'phone' check (
    channel in ('phone', 'email', 'sms', 'whatsapp', 'webchat', 'voice', 'office', 'other')
  ),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  origin text not null default 'office' check (origin in ('office', 'ai', 'system')),
  idempotency_key text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  demo_scenario_key text,
  record_deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    customer_id is not null
    or lead_id is not null
    or job_id is not null
    or quote_id is not null
    or invoice_id is not null
    or platform_conversation_id is not null
  )
);

drop trigger if exists crm_customer_promises_set_updated_at on crm.customer_promises;
create trigger crm_customer_promises_set_updated_at
before update on crm.customer_promises
for each row execute procedure crm.set_updated_at();

create index if not exists crm_customer_promises_tenant_status_due_idx
  on crm.customer_promises (tenant_id, status, due_at asc)
  where record_deleted_at is null;

create index if not exists crm_customer_promises_customer_due_idx
  on crm.customer_promises (tenant_id, customer_id, status, due_at asc)
  where customer_id is not null and record_deleted_at is null;

create index if not exists crm_customer_promises_lead_idx
  on crm.customer_promises (tenant_id, lead_id)
  where lead_id is not null and record_deleted_at is null;

create index if not exists crm_customer_promises_job_idx
  on crm.customer_promises (tenant_id, job_id)
  where job_id is not null and record_deleted_at is null;

create index if not exists crm_customer_promises_quote_idx
  on crm.customer_promises (tenant_id, quote_id)
  where quote_id is not null and record_deleted_at is null;

create index if not exists crm_customer_promises_invoice_idx
  on crm.customer_promises (tenant_id, invoice_id)
  where invoice_id is not null and record_deleted_at is null;

create unique index if not exists crm_customer_promises_idempotency_idx
  on crm.customer_promises (tenant_id, idempotency_key)
  where idempotency_key is not null;

alter table crm.customer_promises enable row level security;

drop policy if exists "crm_read_customer_promises" on crm.customer_promises;
drop policy if exists "crm_insert_customer_promises" on crm.customer_promises;
drop policy if exists "crm_update_customer_promises" on crm.customer_promises;
drop policy if exists "crm_delete_customer_promises" on crm.customer_promises;

create policy "crm_read_customer_promises" on crm.customer_promises
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_customer_promises" on crm.customer_promises
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_customer_promises" on crm.customer_promises
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_customer_promises" on crm.customer_promises
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

insert into crm.customer_promises (
  tenant_id,
  customer_id,
  lead_id,
  promise_type,
  title,
  detail,
  owner_user_id,
  due_at,
  channel,
  status,
  origin,
  idempotency_key,
  is_demo,
  demo_scenario_key,
  created_at,
  updated_at
)
select
  l.tenant_id,
  l.customer_id,
  l.id,
  'follow_up',
  'Lead follow-up',
  coalesce(nullif(l.problem_description, ''), nullif(l.notes, ''), 'Customer follow-up is due.'),
  l.assigned_to,
  l.next_action_at,
  case
    when c.email is not null and c.phone is null then 'email'
    else 'phone'
  end,
  'open',
  case
    when l.intake_source = 'ai_receptionist' then 'ai'
    else 'system'
  end,
  concat('lead:', l.id::text, ':next_action:', l.next_action_at::text),
  coalesce(l.is_demo, false),
  l.demo_scenario_key,
  coalesce(l.updated_at, l.created_at, timezone('utc', now())),
  coalesce(l.updated_at, l.created_at, timezone('utc', now()))
from crm.leads l
left join crm.customers c on c.id = l.customer_id
where l.next_action_at is not null
  and l.status in ('new', 'contacted', 'follow_up', 'survey_booked', 'quoted', 'accepted', 'booked')
  and l.record_deleted_at is null
on conflict (tenant_id, idempotency_key) where idempotency_key is not null do update
set customer_id = excluded.customer_id,
    owner_user_id = excluded.owner_user_id,
    due_at = excluded.due_at,
    detail = excluded.detail,
    status = excluded.status,
    updated_at = timezone('utc', now());
