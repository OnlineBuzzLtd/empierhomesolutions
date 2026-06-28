#!/usr/bin/env node

/**
 * One-off importer for Empire Home Solutions customer workbook data.
 *
 * Dry-run by default:
 *   node scripts/ehs-customer-data-import.mjs
 *
 * Apply after reviewing the preview:
 *   node scripts/ehs-customer-data-import.mjs --apply
 *
 * Optional workbook override:
 *   node scripts/ehs-customer-data-import.mjs --file "/path/to/EHS.xlsx"
 */

import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";
import {
  DEFAULT_WORKBOOK_PATH,
  EMPIRE_TENANT,
  applyImportPlan,
  assertEmpireTenant,
  buildImportPlan,
  formatPlanReport,
  makeCatalog,
  makeExistingState,
  parseArgs,
  prepareWorkbookImport,
  readWorkbook,
  summarizePlan,
  verifyImportedRows,
} from "./ehs-customer-data-import-lib.mjs";

function log(...args) {
  console.log(...args);
}

async function fetchTenant(admin) {
  const { data, error } = await admin
    .schema("crm")
    .from("tenants")
    .select("id, slug, name, status")
    .eq("id", EMPIRE_TENANT.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchCatalog(admin) {
  const [{ data: services, error: servicesError }, { data: jobTypes, error: jobTypesError }] = await Promise.all([
    admin.schema("crm").from("services").select("id, tenant_id, slug, name").eq("tenant_id", EMPIRE_TENANT.id),
    admin.schema("crm").from("job_types").select("id, tenant_id, service_id, slug, name").eq("tenant_id", EMPIRE_TENANT.id),
  ]);
  if (servicesError) throw servicesError;
  if (jobTypesError) throw jobTypesError;
  return makeCatalog(services ?? [], jobTypes ?? []);
}

async function fetchExistingState(admin) {
  const [customers, sites, leads, jobs] = await Promise.all([
    admin
      .schema("crm")
      .from("customers")
      .select("id, tenant_id, full_name, phone, email, address_line1, postcode, archived, is_test")
      .eq("tenant_id", EMPIRE_TENANT.id),
    admin
      .schema("crm")
      .from("sites")
      .select("id, tenant_id, customer_id, address_line1, postcode, is_primary, is_demo")
      .eq("tenant_id", EMPIRE_TENANT.id),
    admin
      .schema("crm")
      .from("leads")
      .select("id, tenant_id, customer_id, notes, source, status, is_test")
      .eq("tenant_id", EMPIRE_TENANT.id),
    admin
      .schema("crm")
      .from("jobs")
      .select("id, tenant_id, customer_id, lead_id, description, status, is_test")
      .eq("tenant_id", EMPIRE_TENANT.id),
  ]);

  for (const result of [customers, sites, leads, jobs]) {
    if (result.error) throw result.error;
  }

  return makeExistingState({
    customers: customers.data ?? [],
    sites: sites.data ?? [],
    leads: leads.data ?? [],
    jobs: jobs.data ?? [],
  });
}

function validateCatalog(prepared, catalog) {
  const missing = [];
  for (const deal of prepared.dealRows) {
    if (deal.serviceSlug && !catalog.serviceIdsBySlug.has(deal.serviceSlug)) {
      missing.push(`service:${deal.serviceSlug}`);
    }
    if (deal.jobTypeSlug && !catalog.jobTypeIdsBySlug.has(deal.jobTypeSlug)) {
      missing.push(`job_type:${deal.jobTypeSlug}`);
    }
  }
  const uniqueMissing = [...new Set(missing)];
  if (uniqueMissing.length > 0) {
    throw new Error(`Required service catalogue entries are missing: ${uniqueMissing.join(", ")}`);
  }
}

function assertNoResidualCreates(summary) {
  const totalCreates = summary.customersToCreate + summary.sitesToCreate + summary.leadsToCreate + summary.jobsToCreate;
  if (totalCreates !== 0) {
    throw new Error(
      `Post-apply dry-run still has pending creates: customers=${summary.customersToCreate}, sites=${summary.sitesToCreate}, leads=${summary.leadsToCreate}, jobs=${summary.jobsToCreate}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workbookPath = args.workbookPath || DEFAULT_WORKBOOK_PATH;
  const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);

  log("ehs-customer-data-import.mjs");
  log(`  mode:     ${args.apply ? "APPLY (will write)" : "DRY RUN (no changes will be written)"}`);
  log(`  workbook: ${workbookPath}`);
  log(`  tenant:   ${EMPIRE_TENANT.name} (${EMPIRE_TENANT.id})`);
  log("");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tenant = await fetchTenant(admin);
  assertEmpireTenant(tenant);

  const workbook = readWorkbook(workbookPath);
  const prepared = prepareWorkbookImport(workbook);
  const catalog = await fetchCatalog(admin);
  validateCatalog(prepared, catalog);
  const existing = await fetchExistingState(admin);
  const plan = buildImportPlan(prepared, existing, catalog);

  log(`Workbook rows: customer_list=${prepared.customerRows.length}, Deals=${prepared.dealRows.length}`);
  log("");
  log(formatPlanReport(plan));

  if (!args.apply) {
    log("");
    log("Dry run complete. Re-run with --apply to write importable rows; review-list rows will be skipped.");
    return;
  }

  log("");
  log("Applying importable rows...");
  const created = await applyImportPlan(admin, plan);
  const verified = await verifyImportedRows(admin, created);
  log(
    `Verified created rows: customers=${verified.customers}, sites=${verified.sites}, leads=${verified.leads}, jobs=${verified.jobs}`,
  );

  log("");
  log("Running post-apply dry-run check...");
  const postExisting = await fetchExistingState(admin);
  const postPlan = buildImportPlan(prepared, postExisting, catalog);
  const postSummary = summarizePlan(postPlan);
  assertNoResidualCreates(postSummary);
  log(formatPlanReport(postPlan));
  log("");
  log("Import apply complete. Post-apply dry-run has zero pending creates.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
