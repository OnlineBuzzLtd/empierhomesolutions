-- Demo Console E-2 + E-6 · Session anchor table + per-tenant kill switch.
--
-- crm.demo_sessions
--   The session row is created when the operator captures the prospect's
--   written PECR consent (E-2). It's the anchor everything else hangs
--   off: the live-pane filters `created_at >= started_at`; the cleanup
--   endpoint deletes is_test rows scoped by tenant + session window
--   (E-5); the kill switch (E-6) freezes triggers tied to this session.
--
--   Why a real table and not just a cookie / localStorage value?
--     - Audit trail for PECR: we need a durable record of the consent
--       text and the prospect's consent timestamp.
--     - Cleanup safety: scope window comes from the DB row, not a
--       browser-side timestamp the operator could fudge.
--     - Multi-device: in F-3 the runbook may suggest the operator opens
--       the same session on their phone for the kill button while the
--       prospect uses the laptop. Shared state needs to live in Postgres.
--
-- crm.tenant_settings.demo_kill_switch_at
--   When set, the Demo Console disables trigger buttons in the UI and
--   the platform-api (separate repo, ticket G-1) halts new outbound for
--   the tenant. Cleared explicitly via the operator panel when the
--   operator is ready to demo again.
--
-- Both changes are additive + reversible.

create table if not exists crm.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  started_by uuid references auth.users(id) on delete set null,
  prospect_name text not null,
  prospect_phone text not null,
  consent_text text not null,
  consent_recorded_at timestamptz not null default timezone('utc', now()),
  -- Free-form notes the operator may add at end-of-demo (e.g. "follow up
  -- Tuesday"). Not surfaced in any prospect-facing UI.
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_demo_sessions_tenant_started_at
  on crm.demo_sessions(tenant_id, started_at desc);

-- Partial index for the "active session" lookup. A session is active
-- while ended_at is null.
create index if not exists crm_demo_sessions_active_partial
  on crm.demo_sessions(tenant_id)
  where ended_at is null;

alter table crm.demo_sessions enable row level security;

-- Restrict to tenant members (consistent with the rest of crm.*).
-- Manager/admin only is enforced at the API layer; RLS just prevents
-- cross-tenant reads via PostgREST.
create policy "crm_demo_sessions_tenant_select"
  on crm.demo_sessions
  for select
  to authenticated
  using (tenant_id = crm.current_user_tenant_id());

create policy "crm_demo_sessions_tenant_insert"
  on crm.demo_sessions
  for insert
  to authenticated
  with check (tenant_id = crm.current_user_tenant_id());

create policy "crm_demo_sessions_tenant_update"
  on crm.demo_sessions
  for update
  to authenticated
  using (tenant_id = crm.current_user_tenant_id())
  with check (tenant_id = crm.current_user_tenant_id());

alter table crm.tenant_settings
  add column if not exists demo_kill_switch_at timestamptz;
