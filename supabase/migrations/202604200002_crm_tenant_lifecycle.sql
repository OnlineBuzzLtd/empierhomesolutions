-- Phase 3.3: tenant lifecycle
--
-- Adds soft-delete metadata + an audit trail for platform_admin actions so
-- suspend / resume / delete operations are fully observable.

alter table crm.tenants
  add column if not exists deleted_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

create index if not exists crm_tenants_deleted_at_idx on crm.tenants (deleted_at)
  where deleted_at is not null;
create index if not exists crm_tenants_suspended_at_idx on crm.tenants (suspended_at)
  where suspended_at is not null;

create table if not exists crm.tenant_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  action text not null check (action in ('suspend', 'resume', 'soft_delete', 'hard_delete', 'export')),
  actor text not null,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_tenant_lifecycle_events_tenant_idx
  on crm.tenant_lifecycle_events (tenant_id, created_at desc);

alter table crm.tenant_lifecycle_events enable row level security;

drop policy if exists "crm_read_tenant_lifecycle_events" on crm.tenant_lifecycle_events;
create policy "crm_read_tenant_lifecycle_events" on crm.tenant_lifecycle_events
  for select using (false);
