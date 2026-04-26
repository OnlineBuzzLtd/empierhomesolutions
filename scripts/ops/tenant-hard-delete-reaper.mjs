#!/usr/bin/env node
/**
 * Phase 3.3 hard-delete reaper.
 *
 * Runs daily (e.g. a GCP Cloud Scheduler job hitting
 * `node scripts/ops/tenant-hard-delete-reaper.mjs`). For any tenant in
 * `crm.tenants` where `deleted_at < now() - 30 days` we cascade a true
 * delete. FK constraints on all tenant-scoped tables are `on delete
 * cascade`, so a single `delete from crm.tenants where id = $1` is
 * sufficient to purge every tenant-owned row.
 *
 * Env:
 *   SUPABASE_URL                  (required)
 *   SUPABASE_SERVICE_ROLE_KEY     (required)
 *   TENANT_HARD_DELETE_DAYS       (optional, defaults to 30)
 *   DRY_RUN                       (optional, "1" to print without deleting)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(2);
}

const retentionDays = Number.parseInt(process.env.TENANT_HARD_DELETE_DAYS ?? "30", 10);
if (!Number.isFinite(retentionDays) || retentionDays < 1) {
  console.error("TENANT_HARD_DELETE_DAYS must be >= 1");
  process.exit(2);
}

const dryRun = process.env.DRY_RUN === "1";
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: candidates, error } = await admin
  .schema("crm")
  .from("tenants")
  .select("id, slug, deleted_at")
  .not("deleted_at", "is", null)
  .lt("deleted_at", cutoff);

if (error) {
  console.error("failed to list tenants", error);
  process.exit(1);
}

if (!candidates || candidates.length === 0) {
  console.log("no tenants eligible for hard delete");
  process.exit(0);
}

console.log(`found ${candidates.length} tenant(s) eligible for hard delete`);

for (const tenant of candidates) {
  console.log(`reaping tenant ${tenant.slug} (${tenant.id}) deleted_at=${tenant.deleted_at}`);
  if (dryRun) {
    continue;
  }

  const { error: deleteError } = await admin
    .schema("crm")
    .from("tenants")
    .delete()
    .eq("id", tenant.id);

  if (deleteError) {
    console.error(`failed to hard-delete ${tenant.id}:`, deleteError.message);
    continue;
  }

  // Audit trail is cascaded via FK; write a fresh marker row into
  // tenant_lifecycle_events on a surviving tenant if you need an
  // immutable record in a central audit DB, omitted here for
  // simplicity.
  console.log(`reaped ${tenant.id}`);
}

process.exit(0);
