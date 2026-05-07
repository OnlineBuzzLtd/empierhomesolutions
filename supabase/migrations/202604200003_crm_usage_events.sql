-- Phase 4: per-tenant usage metering.
--
-- A single append-only table for usage primitives so billing and the
-- BigQuery sink both have one canonical source. Cloud Logging exports
-- can mirror these rows for long-term retention.

create table if not exists crm.usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  event_type text not null,
  quantity numeric(12, 4) not null default 1,
  unit text not null default 'count',
  source text,
  occurred_at timestamptz not null default timezone('utc', now()),
  metadata jsonb
);

create index if not exists crm_usage_events_tenant_occurred_idx
  on crm.usage_events (tenant_id, occurred_at desc);
create index if not exists crm_usage_events_type_idx
  on crm.usage_events (event_type, occurred_at desc);

alter table crm.usage_events enable row level security;

-- Tenant operators can see their own usage; service role bypasses RLS.
drop policy if exists "crm_read_usage_events" on crm.usage_events;
create policy "crm_read_usage_events" on crm.usage_events
  for select to authenticated using (crm.is_tenant_member(tenant_id));
