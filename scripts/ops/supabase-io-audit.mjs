#!/usr/bin/env node

import path from "node:path";
import pg from "pg";
import { requireEnv } from "../crm-env.mjs";
import { ensureProofDir, parseArgs, writeJson } from "../perf/crm-performance-proof-lib.mjs";

const { Client } = pg;
const args = parseArgs(process.argv.slice(2));
const limit = Number.parseInt(args.values.limit ?? "25", 10);
const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 25;
const tenantId = args.values.tenantId ?? "11111111-1111-4111-8111-111111111111";

function projectRefFromUrl(url) {
  return new URL(url).hostname.split(".")[0];
}

function compactQuery(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/'(?:[^']|''){32,}'/g, "'[redacted-long-literal]'")
    .slice(0, 500);
}

async function tryQuery(client, name, sql, params = []) {
  try {
    const { rows } = await client.query(sql, params);
    return { name, ok: true, rows };
  } catch (caught) {
    return {
      name,
      ok: false,
      error: caught instanceof Error ? caught.message : "Unknown query error",
      rows: [],
    };
  }
}

function summarize(payload) {
  const tableReads = payload.sections.tablePhysicalReads.rows.slice(0, 5).map((row) => ({
    table: row.relname,
    blocksRead: Number(row.heap_blks_read) + Number(row.idx_blks_read) + Number(row.toast_blks_read ?? 0) + Number(row.tidx_blks_read ?? 0),
    totalSize: row.total_size,
  }));
  const wal = payload.sections.topStatementWal.rows.slice(0, 5).map((row) => ({
    calls: Number(row.calls),
    wal: row.wal,
    meanMs: Number(row.mean_ms),
    query: compactQuery(row.query),
  }));
  const seqScans = payload.sections.tableSeqScans.rows.slice(0, 5).map((row) => ({
    table: row.relname,
    seqScan: Number(row.seq_scan),
    seqTuplesRead: Number(row.seq_tup_read),
    liveRows: Number(row.n_live_tup),
    deadRows: Number(row.n_dead_tup),
  }));
  return { tableReads, wal, seqScans };
}

function buildMarkdown(payload) {
  const section = (title, rows, columns) => {
    if (!rows.length) return `## ${title}\n\nNo rows.\n`;
    const header = `| ${columns.join(" | ")} |`;
    const divider = `| ${columns.map(() => "---").join(" | ")} |`;
    const body = rows
      .map((row) => `| ${columns.map((column) => String(row[column] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`)
      .join("\n");
    return `## ${title}\n\n${header}\n${divider}\n${body}\n`;
  };

  return `# Supabase Disk IO Audit

Captured: ${payload.capturedAt}
Project: ${payload.projectRef}
Tenant: ${payload.tenantId}

## Summary

- Highest physical-read tables: ${payload.summary.tableReads.map((row) => `${row.table} (${row.blocksRead} blocks)`).join(", ") || "none"}
- Highest WAL statements: ${payload.summary.wal.map((row) => `${row.wal} / ${row.calls} calls`).join(", ") || "none"}
- Highest seq-scan tables: ${payload.summary.seqScans.map((row) => `${row.table} (${row.seqTuplesRead} tuples)`).join(", ") || "none"}

${section("Table Physical Reads", payload.sections.tablePhysicalReads.rows, ["relname", "heap_blks_read", "idx_blks_read", "toast_blks_read", "tidx_blks_read", "total_size"])}

${section("Table Sequential Scans", payload.sections.tableSeqScans.rows, ["relname", "seq_scan", "seq_tup_read", "idx_scan", "n_live_tup", "n_dead_tup", "dead_ratio"])}

${section("Largest CRM Tables", payload.sections.tableSizes.rows, ["relname", "table_size", "index_size", "total_size"])}

${section("Top Statements By WAL", payload.sections.topStatementWal.rows, ["calls", "total_ms", "mean_ms", "shared_blks_read", "shared_blks_dirtied", "shared_blks_written", "wal", "query"])}

${section("Top Statements By Physical Reads", payload.sections.topStatementReads.rows, ["calls", "total_ms", "mean_ms", "shared_blks_read", "shared_blks_hit", "wal", "query"])}

${section("High Call Statements", payload.sections.highCallStatements.rows, ["calls", "total_ms", "mean_ms", "shared_blks_read", "shared_blks_hit", "wal", "query"])}

${section("Autovacuum And Dead Rows", payload.sections.autovacuum.rows, ["relname", "n_live_tup", "n_dead_tup", "vacuum_count", "autovacuum_count", "last_autovacuum", "last_autoanalyze"])}
`;
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const projectRef = projectRefFromUrl(supabaseUrl);
const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: requireEnv("SUPABASE_DB_PASSWORD"),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const sections = {};
  for (const result of [
    await tryQuery(client, "tenants", "select id, slug, name from crm.tenants order by created_at limit $1", [safeLimit]),
    await tryQuery(
      client,
      "tablePhysicalReads",
      `
        select schemaname, relname,
          heap_blks_read, idx_blks_read, toast_blks_read, tidx_blks_read,
          heap_blks_hit, idx_blks_hit,
          pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname))) as total_size
        from pg_statio_user_tables
        where schemaname = 'crm'
        order by coalesce(heap_blks_read,0)+coalesce(idx_blks_read,0)+coalesce(toast_blks_read,0)+coalesce(tidx_blks_read,0) desc
        limit $1
      `,
      [safeLimit],
    ),
    await tryQuery(
      client,
      "tableSeqScans",
      `
        select schemaname, relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch, n_live_tup, n_dead_tup,
          round(case when n_live_tup > 0 then n_dead_tup::numeric / n_live_tup else 0 end, 3) as dead_ratio
        from pg_stat_user_tables
        where schemaname = 'crm'
        order by seq_tup_read desc
        limit $1
      `,
      [safeLimit],
    ),
    await tryQuery(
      client,
      "tableSizes",
      `
        select schemaname, relname,
          pg_size_pretty(pg_relation_size(format('%I.%I', schemaname, relname))) as table_size,
          pg_size_pretty(pg_indexes_size(format('%I.%I', schemaname, relname))) as index_size,
          pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname))) as total_size
        from pg_stat_user_tables
        where schemaname = 'crm'
        order by pg_total_relation_size(format('%I.%I', schemaname, relname)) desc
        limit $1
      `,
      [safeLimit],
    ),
    await tryQuery(
      client,
      "topStatementWal",
      `
        select calls, round(total_exec_time::numeric, 1) total_ms, round(mean_exec_time::numeric, 2) mean_ms,
          shared_blks_read, shared_blks_dirtied, shared_blks_written, wal_records, pg_size_pretty(wal_bytes) as wal,
          regexp_replace(query, '\\s+', ' ', 'g') as query
        from pg_stat_statements
        where dbid = (select oid from pg_database where datname = current_database())
        order by wal_bytes desc nulls last, shared_blks_dirtied desc
        limit $1
      `,
      [safeLimit],
    ),
    await tryQuery(
      client,
      "topStatementReads",
      `
        select calls, round(total_exec_time::numeric, 1) total_ms, round(mean_exec_time::numeric, 2) mean_ms,
          shared_blks_read, shared_blks_hit, shared_blks_dirtied, pg_size_pretty(coalesce(wal_bytes,0)) as wal,
          regexp_replace(query, '\\s+', ' ', 'g') as query
        from pg_stat_statements
        where dbid = (select oid from pg_database where datname = current_database())
        order by shared_blks_read desc
        limit $1
      `,
      [safeLimit],
    ),
    await tryQuery(
      client,
      "highCallStatements",
      `
        select calls, round(total_exec_time::numeric, 1) total_ms, round(mean_exec_time::numeric, 2) mean_ms,
          shared_blks_read, shared_blks_hit, shared_blks_dirtied, pg_size_pretty(coalesce(wal_bytes,0)) as wal,
          regexp_replace(query, '\\s+', ' ', 'g') as query
        from pg_stat_statements
        where dbid = (select oid from pg_database where datname = current_database())
        order by calls desc
        limit $1
      `,
      [safeLimit],
    ),
    await tryQuery(
      client,
      "autovacuum",
      `
        select schemaname, relname, n_live_tup, n_dead_tup, vacuum_count, autovacuum_count,
          analyze_count, autoanalyze_count, last_autovacuum, last_autoanalyze
        from pg_stat_user_tables
        where schemaname = 'crm'
        order by n_dead_tup desc
        limit $1
      `,
      [safeLimit],
    ),
  ]) {
    sections[result.name] = {
      ok: result.ok,
      error: result.error ?? null,
      rows: result.rows.map((row) => ({ ...row, query: row.query ? compactQuery(row.query) : row.query })),
    };
  }

  const payload = {
    capturedAt: new Date().toISOString(),
    projectRef,
    tenantId,
    sections,
  };
  payload.summary = summarize(payload);

  const proofDir = ensureProofDir();
  const jsonPath = path.join(proofDir, "supabase-io-audit.json");
  const markdownPath = path.join(proofDir, "SUPABASE_IO_AUDIT.md");
  writeJson(jsonPath, payload);
  await import("node:fs").then((fs) => fs.writeFileSync(markdownPath, buildMarkdown(payload)));

  console.log(`[supabase:io] wrote ${jsonPath}`);
  console.log(`[supabase:io] wrote ${markdownPath}`);
  console.log(JSON.stringify(payload.summary, null, 2));
} finally {
  await client.end();
}
