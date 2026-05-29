create table if not exists crm.cron_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references crm.tenants(id) on delete cascade,
  job_name text not null,
  window_start timestamptz not null,
  idempotency_key text not null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'skipped')),
  result jsonb not null default '{}'::jsonb,
  last_error text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (idempotency_key)
);

create trigger crm_cron_dispatch_log_set_updated_at
before update on crm.cron_dispatch_log
for each row execute procedure crm.set_updated_at();

create index if not exists crm_cron_dispatch_log_job_window_idx
  on crm.cron_dispatch_log (job_name, window_start desc);

create index if not exists crm_cron_dispatch_log_tenant_job_idx
  on crm.cron_dispatch_log (tenant_id, job_name, window_start desc)
  where tenant_id is not null;

alter table crm.cron_dispatch_log enable row level security;

create policy "crm_read_cron_dispatch_log" on crm.cron_dispatch_log
for select to authenticated
using (tenant_id is not null and crm.is_tenant_member(tenant_id));

create table if not exists crm.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  recipient text not null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  dispatch_at timestamptz not null,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  idempotency_key text,
  is_test boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_scheduled_notifications_set_updated_at
before update on crm.scheduled_notifications
for each row execute procedure crm.set_updated_at();

create unique index if not exists crm_scheduled_notifications_idempotency_key_idx
  on crm.scheduled_notifications (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists crm_scheduled_notifications_due_idx
  on crm.scheduled_notifications (dispatch_at, next_attempt_at)
  where status = 'pending';

create index if not exists crm_scheduled_notifications_tenant_status_idx
  on crm.scheduled_notifications (tenant_id, status, dispatch_at desc);

alter table crm.scheduled_notifications enable row level security;

create policy "crm_read_scheduled_notifications" on crm.scheduled_notifications
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_scheduled_notifications" on crm.scheduled_notifications
for insert to authenticated
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_scheduled_notifications" on crm.scheduled_notifications
for update to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_delete_scheduled_notifications" on crm.scheduled_notifications
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
