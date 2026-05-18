-- Demo Console B-1 · Extend the is_test flag from crm.appointments to
-- crm.customers, crm.leads, and crm.jobs.
--
-- Why: the Demo Console (see src/modules/crm/demo-console/README.md) runs
-- live prospect demos against the prod CRM and creates real customer +
-- lead + job + appointment rows that must be wiped at session end. The
-- cleanup endpoint (ticket E-5) scope-filters by `tenant_id` + `is_test
-- = true` + `created_at >= sessions.started_at`. Today only appointments
-- carry that flag — without this migration the cleanup either cannot
-- find demo customers/leads/jobs (orphans accumulate in prod) or has to
-- guess by timestamp alone (unsafe; could delete real rows).
--
-- This mirrors the additive, reversible pattern from CAL-003
-- (202605130001_crm_appointments_is_test.sql): boolean, default false,
-- not null, no backfill, partial index for fast cleanup scans.
--
-- Rollback:
--   alter table crm.customers drop column if exists is_test;
--   alter table crm.leads     drop column if exists is_test;
--   alter table crm.jobs      drop column if exists is_test;

alter table crm.customers
  add column if not exists is_test boolean not null default false;

alter table crm.leads
  add column if not exists is_test boolean not null default false;

alter table crm.jobs
  add column if not exists is_test boolean not null default false;

-- Partial indexes — same rationale as appointments. The vast majority of
-- rows are is_test=false; we only need fast lookups on the rare true
-- side (cleanup scans + the Demo Console live pane subscription filter).
create index if not exists crm_customers_is_test_partial
  on crm.customers(is_test)
  where is_test = true;

create index if not exists crm_leads_is_test_partial
  on crm.leads(is_test)
  where is_test = true;

create index if not exists crm_jobs_is_test_partial
  on crm.jobs(is_test)
  where is_test = true;
