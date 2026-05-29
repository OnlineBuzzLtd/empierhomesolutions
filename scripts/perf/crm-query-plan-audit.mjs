#!/usr/bin/env node

const tenantId = process.env.TENANT_ID ?? "00000000-0000-0000-0000-000000000000";
const mode = process.env.CRM_MODE ?? "live";
const scenarioKey = process.env.CRM_DEMO_SCENARIO_KEY ?? "core-walkthrough";

const modePredicate = (alias) =>
  mode === "demo"
    ? `${alias}.is_demo = true and coalesce(${alias}.demo_scenario_key, 'core-walkthrough') = '${scenarioKey}'`
    : `${alias}.is_demo = false`;

const explain = (label, sql) => `-- ${label}
explain (analyze, buffers, format text)
${sql.trim()};
`;

const plans = [
  explain(
    "Dashboard summary read model",
    `select crm.dashboard_summary('${mode}', '${scenarioKey}')`,
  ),
  explain(
    "Jobs list",
    `select id, title, status, scheduled_date, scheduled_time, created_at
from crm.jobs j
where j.tenant_id = '${tenantId}'
  and ${modePredicate("j")}
order by j.created_at desc
limit 50`,
  ),
  explain(
    "Leads list",
    `select id, status, source, next_action_at, created_at
from crm.leads l
where l.tenant_id = '${tenantId}'
  and ${modePredicate("l")}
order by l.created_at desc
limit 50`,
  ),
  explain(
    "Customers list",
    `select id, full_name, phone, postcode, created_at
from crm.customers c
where c.tenant_id = '${tenantId}'
  and c.archived = false
  and ${modePredicate("c")}
order by c.created_at desc
limit 50`,
  ),
  explain(
    "Quotes list",
    `select id, quote_number, status, total, created_at
from crm.quotes q
where q.tenant_id = '${tenantId}'
  and ${modePredicate("q")}
order by q.created_at desc
limit 50`,
  ),
  explain(
    "Invoices list",
    `select id, invoice_number, status, total, due_date, created_at
from crm.invoices i
where i.tenant_id = '${tenantId}'
  and ${modePredicate("i")}
order by i.created_at desc
limit 50`,
  ),
  explain(
    "Calendar window",
    `select id, title, starts_at, ends_at, status
from crm.appointments a
where a.tenant_id = '${tenantId}'
  and ${modePredicate("a")}
  and a.starts_at >= now() - interval '7 days'
  and a.starts_at < now() + interval '30 days'
order by a.starts_at asc
limit 500`,
  ),
  explain(
    "Reports summary read model",
    `select crm.reports_summary('${mode}', '${scenarioKey}')`,
  ),
];

console.log(`-- CRM query plan audit
-- Set TENANT_ID to the tenant UUID before running against staging/production.
-- Example:
--   TENANT_ID=... CRM_MODE=live node scripts/perf/crm-query-plan-audit.mjs | psql "$DATABASE_URL"
-- This script only prints EXPLAIN SQL; it does not connect to the database.

${plans.join("\n")}`);
