#!/usr/bin/env node

import path from "node:path";
import pg from "pg";
import { getEnv, requireEnv } from "../crm-env.mjs";
import {
  ensureProofDir,
  evaluateExplainBudgets,
  parseArgs,
  proofDirForManifest,
  readLatestManifest,
  writeJson,
} from "./crm-performance-proof-lib.mjs";

const { Client } = pg;
const args = parseArgs(process.argv.slice(2));
const printSql = args.flags.has("print-sql");
const manifest = readLatestManifest();
const tenantId =
  args.values.tenantId ??
  process.env.CRM_PERF_TENANT_ID ??
  manifest?.tenant?.id ??
  (printSql ? "00000000-0000-0000-0000-000000000000" : null);
const userId = args.values.userId ?? process.env.CRM_PERF_USER_ID ?? manifest?.auth?.userId;
const supabaseUrl = printSql ? (getEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "https://example.supabase.co") : requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const dbPassword = printSql ? (getEnv("SUPABASE_DB_PASSWORD") ?? "dry-run") : requireEnv("SUPABASE_DB_PASSWORD");

if (!tenantId) {
  throw new Error("Missing tenant id. Run crm:perf:seed first or pass --tenantId.");
}

function projectRefFromUrl(url) {
  return new URL(url).hostname.split(".")[0];
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const modePredicate = (alias) => `${alias}.is_demo = false`;
const queries = [
  {
    name: "jobs-list",
    thresholdMs: 250,
    disallowSeqScan: ["jobs"],
    sql: `select id, title, status, scheduled_date, scheduled_time, created_at
from crm.jobs j
where j.tenant_id = ${sqlString(tenantId)}
  and ${modePredicate("j")}
order by j.created_at desc
limit 50`,
  },
  {
    name: "leads-list",
    thresholdMs: 250,
    disallowSeqScan: ["leads"],
    sql: `select id, status, source, next_action_at, created_at
from crm.leads l
where l.tenant_id = ${sqlString(tenantId)}
  and ${modePredicate("l")}
order by l.created_at desc
limit 50`,
  },
  {
    name: "customers-list",
    thresholdMs: 250,
    disallowSeqScan: ["customers"],
    sql: `select id, full_name, phone, postcode, created_at
from crm.customers c
where c.tenant_id = ${sqlString(tenantId)}
  and c.archived = false
  and ${modePredicate("c")}
order by c.created_at desc
limit 50`,
  },
  {
    name: "quotes-list",
    thresholdMs: 250,
    disallowSeqScan: ["quotes"],
    sql: `select id, quote_number, status, total, created_at
from crm.quotes q
where q.tenant_id = ${sqlString(tenantId)}
  and ${modePredicate("q")}
order by q.created_at desc
limit 50`,
  },
  {
    name: "invoices-list",
    thresholdMs: 250,
    disallowSeqScan: ["invoices"],
    sql: `select id, invoice_number, status, total, due_date, created_at
from crm.invoices i
where i.tenant_id = ${sqlString(tenantId)}
  and ${modePredicate("i")}
order by i.created_at desc
limit 50`,
  },
  {
    name: "calendar-window",
    thresholdMs: 250,
    disallowSeqScan: ["appointments"],
    sql: `select id, title, starts_at, ends_at, status
from crm.appointments a
where a.tenant_id = ${sqlString(tenantId)}
  and ${modePredicate("a")}
  and a.starts_at >= now() - interval '7 days'
  and a.starts_at < now() + interval '30 days'
order by a.starts_at asc
limit 500`,
  },
  {
    name: "dashboard-summary",
    thresholdMs: 250,
    disallowSeqScan: ["jobs", "leads", "invoices"],
    sql: `select crm.dashboard_summary('live', 'core-walkthrough')`,
  },
  {
    name: "reports-summary",
    thresholdMs: 250,
    disallowSeqScan: ["jobs", "leads", "invoices", "expenses"],
    sql: `select crm.reports_summary('live', 'core-walkthrough')`,
  },
];

if (printSql) {
  for (const query of queries) {
    console.log(`-- ${query.name}\nexplain (analyze, buffers, format json)\n${query.sql};\n`);
  }
  process.exit(0);
}

const ref = projectRefFromUrl(supabaseUrl);
const client = new Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  if (userId) {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
  }

  const rawResults = [];
  for (const query of queries) {
    const explained = await client.query(`explain (analyze, buffers, format json) ${query.sql}`);
    const doc = explained.rows[0]["QUERY PLAN"][0];
    rawResults.push({
      name: query.name,
      thresholdMs: query.thresholdMs,
      disallowSeqScan: query.disallowSeqScan,
      executionTimeMs: Math.round(doc["Execution Time"] * 10) / 10,
      planningTimeMs: Math.round(doc["Planning Time"] * 10) / 10,
      plan: doc.Plan,
    });
    console.log(`[crm:perf:explain] ${query.name} ${doc["Execution Time"]}ms`);
  }

  const evaluated = evaluateExplainBudgets(rawResults);
  const payload = {
    capturedAt: new Date().toISOString(),
    tenant: manifest?.tenant ?? { id: tenantId },
    queries: evaluated,
    passed: evaluated.every((query) => query.passed),
  };
  const proofDir = manifest ? proofDirForManifest(manifest) : ensureProofDir();
  writeJson(path.join(proofDir, "explain.json"), payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.passed ? 0 : 1;
} finally {
  if (userId) {
    await client.query("rollback").catch(() => null);
  }
  await client.end();
}
