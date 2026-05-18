-- Demo Console B-2 · Add the per-tenant enable flag for the Demo Console.
--
-- Why: the Demo Console (src/modules/crm/demo-console/README.md) is a
-- product capability — Empire opts in to pitch plumbers; later, customer
-- tenants can opt in to pitch their own prospects. The `/demo` route
-- 404s when this flag is false, and the new sidebar item is hidden.
--
-- Default false everywhere (safe for existing tenants). Empire tenant
-- (11111111-1111-4111-8111-111111111111) is seeded true so the operator
-- can start using the capability as soon as the route lands.
--
-- Additive + reversible.
-- Rollback:
--   alter table crm.tenant_settings drop column if exists demo_console_enabled;

alter table crm.tenant_settings
  add column if not exists demo_console_enabled boolean not null default false;

update crm.tenant_settings
   set demo_console_enabled = true
 where tenant_id = '11111111-1111-4111-8111-111111111111';
