-- Disk IO budget response: RLS helper fast path.
--
-- pg_stat_user_tables showed millions of sequential scans on
-- crm.tenant_memberships from current_user_tenant_id()/is_active_user().
-- The existing unique index is tenant_id-first, which is not ideal for
-- "find the active membership for auth.uid()" checks used by most CRM RLS
-- policies. This small additive index keeps those checks index-backed.

create index if not exists crm_tenant_memberships_user_active_owner_idx
  on crm.tenant_memberships (user_id, active, is_owner desc, created_at asc)
  include (tenant_id, role);
