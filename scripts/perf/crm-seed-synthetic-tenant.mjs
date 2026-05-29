#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "../crm-env.mjs";
import { ensureProofDir, intArg, nowStamp, parseArgs, readLatestManifest, writeJson } from "./crm-performance-proof-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const dryRun = args.flags.has("dry-run");
const cleanup = args.flags.has("cleanup");
const stamp = args.values.stamp ?? nowStamp();
const slug = args.values.slug ?? process.env.CRM_PERF_TENANT_SLUG ?? `perf-proof-${stamp.toLowerCase()}`;
const email = args.values.email ?? process.env.CRM_PERF_ADMIN_EMAIL ?? `${slug}@perf-proof.customerjourneys.test`;
const password = args.values.password ?? process.env.CRM_PERF_ADMIN_PASSWORD ?? `PerfProof-${stamp}!`;
const engineerEmail =
  args.values.engineerEmail ?? process.env.CRM_PERF_ENGINEER_EMAIL ?? `${slug}-engineer@perf-proof.customerjourneys.test`;
const engineerPassword =
  args.values.engineerPassword ?? process.env.CRM_PERF_ENGINEER_PASSWORD ?? `PerfProofEngineer-${stamp}!`;
const engineerName = "Performance Proof Engineer";
const scale = {
  customers: intArg(args, "customers", 5000),
  leads: intArg(args, "leads", 10000),
  jobs: intArg(args, "jobs", 15000),
  appointments: intArg(args, "appointments", 5000),
  quotes: intArg(args, "quotes", 7500),
  invoices: intArg(args, "invoices", 7500),
};
const batchSize = intArg(args, "batch-size", 1000);

const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(message) {
  console.log(`[crm:perf:seed] ${message}`);
}

async function failOn(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function findAuthUserByEmail(targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    await failOn(error, "list auth users");
    const found = data?.users?.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase());
    if (found) return found;
    if (!data?.users || data.users.length < 1000) return null;
  }
  return null;
}

async function cleanupTenant(targetSlug = slug) {
  const { data: tenant, error } = await admin.schema("crm").from("tenants").select("id, slug").eq("slug", targetSlug).maybeSingle();
  await failOn(error, "load tenant for cleanup");

  if (!tenant) {
    const orphanEmails = [email, engineerEmail];
    let deletedAuthUsers = 0;
    for (const orphanEmail of orphanEmails) {
      const authUser = await findAuthUserByEmail(orphanEmail);
      if (authUser) {
        const { error: deleteUserError } = await admin.auth.admin.deleteUser(authUser.id);
        await failOn(deleteUserError, "delete orphan proof auth user");
        deletedAuthUsers += 1;
      }
    }
    return { tenantDeleted: false, deletedAuthUsers };
  }

  const { data: memberships } = await admin.schema("crm").from("tenant_memberships").select("user_id").eq("tenant_id", tenant.id);
  const userIds = [...new Set((memberships ?? []).map((row) => row.user_id).filter(Boolean))];

  const childTables = [
    "invoices",
    "quotes",
    "appointments",
    "jobs",
    "leads",
    "customers",
    "job_types",
    "services",
    "tenant_branding",
    "tenant_settings",
    "user_profiles",
    "tenant_memberships",
  ];
  for (const table of childTables) {
    const { error: deleteRowsError } = await admin.schema("crm").from(table).delete().eq("tenant_id", tenant.id);
    await failOn(deleteRowsError, `delete proof ${table}`);
    log(`deleted proof ${table}`);
  }

  const { error: deleteTenantError } = await admin.schema("crm").from("tenants").delete().eq("id", tenant.id).like("slug", "perf-proof-%");
  await failOn(deleteTenantError, "delete proof tenant");

  for (const userId of userIds) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError && !deleteUserError.message.toLowerCase().includes("not found")) {
      throw new Error(`delete proof auth user ${userId}: ${deleteUserError.message}`);
    }
  }

  return { tenantDeleted: true, deletedAuthUsers: userIds.length };
}

function rowDate(offsetDays) {
  const date = new Date(Date.UTC(2026, 0, 1));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString();
}

async function insertBatches(table, rows) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const batchNumber = i / batchSize + 1;
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const { error } = await admin.schema("crm").from(table).insert(batch);
      if (!error) {
        lastError = null;
        break;
      }
      lastError = error;
      if (attempt < 4) {
        const delayMs = 500 * attempt;
        log(`retrying ${table} batch ${batchNumber} after ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    await failOn(lastError, `insert ${table} batch ${batchNumber}`);
    log(`inserted ${Math.min(i + batch.length, rows.length)}/${rows.length} ${table}`);
  }
}

async function seedTenant() {
  if (dryRun) {
    return {
      dryRun: true,
      slug,
      auth: {
        admin: { email, password },
        engineer: { email: engineerEmail, password: engineerPassword, fullName: engineerName },
      },
      scale,
    };
  }

  await cleanupTenant(slug);

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "CRM Performance Proof Admin" },
  });
  await failOn(userError, "create proof auth user");
  const userId = userData.user.id;
  const { data: engineerUserData, error: engineerUserError } = await admin.auth.admin.createUser({
    email: engineerEmail,
    password: engineerPassword,
    email_confirm: true,
    user_metadata: { full_name: engineerName },
  });
  await failOn(engineerUserError, "create proof engineer auth user");
  const engineerUserId = engineerUserData.user.id;
  const adminProfileId = randomUUID();
  const engineerProfileId = randomUUID();

  const { data: tenant, error: tenantError } = await admin
    .schema("crm")
    .from("tenants")
    .insert({ slug, name: `Performance Proof ${stamp}`, status: "active" })
    .select("id, slug, name")
    .single();
  await failOn(tenantError, "create proof tenant");

  await Promise.all([
    admin.schema("crm").from("tenant_memberships").insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: "admin",
      active: true,
      is_owner: true,
      is_demo: false,
    }),
    admin.schema("crm").from("tenant_memberships").insert({
      tenant_id: tenant.id,
      user_id: engineerUserId,
      role: "engineer",
      active: true,
      is_owner: false,
      is_demo: false,
    }),
    admin.schema("crm").from("user_profiles").insert({
      id: adminProfileId,
      tenant_id: tenant.id,
      user_id: userId,
      role: "admin",
      full_name: "CRM Performance Proof Admin",
      email,
      active: true,
      is_demo: false,
    }),
    admin.schema("crm").from("user_profiles").insert({
      id: engineerProfileId,
      tenant_id: tenant.id,
      user_id: engineerUserId,
      role: "engineer",
      full_name: engineerName,
      email: engineerEmail,
      active: true,
      is_demo: false,
    }),
    admin.schema("crm").from("tenant_branding").insert({
      tenant_id: tenant.id,
      business_name: "Performance Proof Plumbing",
      crm_display_name: "Performance Proof CRM",
      support_email: "support@perf-proof.customerjourneys.test",
      accent_color: "#2563eb",
    }),
    admin.schema("crm").from("tenant_settings").insert({
      tenant_id: tenant.id,
      legal_name: "Performance Proof Plumbing Ltd",
      quote_footer: "Synthetic proof tenant only.",
      invoice_footer: "Synthetic proof tenant only.",
      default_payment_terms: {},
    }),
  ].map(async (promise, index) => {
    const { error } = await promise;
    await failOn(error, `create proof tenant foundation ${index + 1}`);
  }));

  const serviceIds = [randomUUID(), randomUUID(), randomUUID()];
  const services = [
    { id: serviceIds[0], tenant_id: tenant.id, slug: `${slug}-boilers`, name: "Boilers", active: true },
    { id: serviceIds[1], tenant_id: tenant.id, slug: `${slug}-plumbing`, name: "Plumbing", active: true },
    { id: serviceIds[2], tenant_id: tenant.id, slug: `${slug}-drainage`, name: "Drainage", active: true },
  ];
  await insertBatches("services", services);

  const jobTypeIds = [randomUUID(), randomUUID(), randomUUID()];
  const jobTypes = [
    { id: jobTypeIds[0], tenant_id: tenant.id, service_id: serviceIds[0], slug: `${slug}-repair`, name: "Repair", active: true },
    { id: jobTypeIds[1], tenant_id: tenant.id, service_id: serviceIds[1], slug: `${slug}-install`, name: "Install", active: true },
    { id: jobTypeIds[2], tenant_id: tenant.id, service_id: serviceIds[2], slug: `${slug}-emergency`, name: "Emergency", active: true },
  ];
  await insertBatches("job_types", jobTypes);

  const customerIds = Array.from({ length: scale.customers }, () => randomUUID());
  const customers = customerIds.map((id, index) => ({
    id,
    tenant_id: tenant.id,
    full_name: `Proof Customer ${index + 1}`,
    phone: `+4477009${String(index % 100000).padStart(5, "0")}`,
    email: `customer-${index + 1}@perf-proof.customerjourneys.test`,
    address_line1: `${index + 1} Benchmark Road`,
    city: "London",
    postcode: `PP${index % 99} ${index % 10}ZZ`,
    property_type: "house",
    occupancy_type: "owner",
    source: "manual",
    source_enum: "manual",
    notes: "Synthetic performance proof row.",
    archived: false,
    is_demo: false,
    created_at: rowDate(index % 365),
  }));
  await insertBatches("customers", customers);

  const leadIds = Array.from({ length: scale.leads }, () => randomUUID());
  const leadStatuses = ["new", "contacted", "follow_up", "survey_booked", "quoted", "accepted", "booked", "completed", "lost"];
  const leads = leadIds.map((id, index) => ({
    id,
    tenant_id: tenant.id,
    customer_id: customerIds[index % customerIds.length],
    service_id: serviceIds[index % serviceIds.length],
    job_type_id: jobTypeIds[index % jobTypeIds.length],
    status: leadStatuses[index % leadStatuses.length],
    source: "manual",
    source_enum: "manual",
    lead_attribution: {},
    next_action_at: rowDate((index % 30) - 10),
    notes: "Synthetic performance proof lead.",
    is_demo: false,
    created_at: rowDate(index % 365),
  }));
  await insertBatches("leads", leads);

  const jobIds = Array.from({ length: scale.jobs }, () => randomUUID());
  const jobStatuses = ["enquiry", "booked", "in_progress", "completed", "invoiced", "no_access", "aborted"];
  const jobs = jobIds.map((id, index) => ({
    id,
    tenant_id: tenant.id,
    customer_id: customerIds[index % customerIds.length],
    lead_id: leadIds[index % leadIds.length],
    service_id: serviceIds[index % serviceIds.length],
    job_type_id: jobTypeIds[index % jobTypeIds.length],
    title: `Proof job ${index + 1}`,
    description: "Synthetic performance proof job.",
    scheduled_date: rowDate((index % 90) - 30).slice(0, 10),
    scheduled_time: `${String(8 + (index % 9)).padStart(2, "0")}:00:00`,
    duration_hours: 2,
    status: jobStatuses[index % jobStatuses.length],
    assigned_engineer: index % 2 === 0 ? engineerName : `Engineer ${index % 12}`,
    created_by: userId,
    is_demo: false,
    created_at: rowDate(index % 365),
  }));
  await insertBatches("jobs", jobs);

  const appointments = Array.from({ length: scale.appointments }, (_, index) => {
    const starts = new Date(rowDate((index % 90) - 30));
    starts.setUTCHours(8 + (index % 9), 0, 0, 0);
    const ends = new Date(starts);
    ends.setUTCHours(starts.getUTCHours() + 2);
    return {
      id: randomUUID(),
      tenant_id: tenant.id,
      customer_id: customerIds[index % customerIds.length],
      lead_id: leadIds[index % leadIds.length],
      job_id: jobIds[index % jobIds.length],
      assigned_to: engineerUserId,
      type: "booking",
      title: `Proof appointment ${index + 1}`,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: "scheduled",
      is_demo: false,
      created_at: rowDate(index % 365),
    };
  });
  await insertBatches("appointments", appointments);

  const quoteIds = Array.from({ length: scale.quotes }, () => randomUUID());
  const quotes = quoteIds.map((id, index) => {
    const subtotal = 250 + (index % 5000);
    const vat = Math.round(subtotal * 0.2 * 100) / 100;
    return {
      id,
      tenant_id: tenant.id,
      job_id: jobIds[index % jobIds.length],
      customer_id: customerIds[index % customerIds.length],
      quote_number: `PERF-Q-${String(index + 1).padStart(6, "0")}`,
      document_type: "quote",
      current_version_number: 1,
      line_items: [{ description: "Synthetic proof labour", qty: 1, unit_price: subtotal }],
      subtotal,
      vat_rate: 0.2,
      vat_category: "standard_20",
      total: subtotal + vat,
      status: index % 4 === 0 ? "sent" : "draft",
      valid_until: rowDate((index % 60) + 1).slice(0, 10),
      is_demo: false,
      created_at: rowDate(index % 365),
    };
  });
  await insertBatches("quotes", quotes);

  const invoices = Array.from({ length: scale.invoices }, (_, index) => {
    const subtotal = 200 + (index % 5000);
    const vat = Math.round(subtotal * 0.2 * 100) / 100;
    return {
      id: randomUUID(),
      tenant_id: tenant.id,
      quote_id: quoteIds[index % quoteIds.length],
      job_id: jobIds[index % jobIds.length],
      customer_id: customerIds[index % customerIds.length],
      invoice_number: `PERF-I-${String(index + 1).padStart(6, "0")}`,
      line_items: [{ description: "Synthetic proof invoice", qty: 1, unit_price: subtotal }],
      subtotal,
      vat_rate: 0.2,
      vat_category: "standard_20",
      total: subtotal + vat,
      status: index % 5 === 0 ? "paid" : index % 7 === 0 ? "overdue" : "unpaid",
      due_date: rowDate((index % 60) - 20).slice(0, 10),
      paid_at: index % 5 === 0 ? rowDate((index % 30) - 5) : null,
      is_demo: false,
      created_at: rowDate(index % 365),
    };
  });
  await insertBatches("invoices", invoices);

  return {
    dryRun: false,
    stamp,
    proofStamp: stamp,
    createdAt: new Date().toISOString(),
    baseUrl: process.env.CRM_PERF_BASE_URL ?? "https://empire-home-solutions.vercel.app",
    tenant,
    auth: {
      email,
      password,
      userId,
      admin: { email, password, userId, profileId: adminProfileId },
      engineer: {
        email: engineerEmail,
        password: engineerPassword,
        userId: engineerUserId,
        profileId: engineerProfileId,
        fullName: engineerName,
      },
    },
    counts: scale,
  };
}

if (cleanup) {
  const manifest = readLatestManifest();
  const targetSlug = args.values.slug ?? process.env.CRM_PERF_TENANT_SLUG ?? manifest?.tenant?.slug ?? slug;
  const result = dryRun ? { dryRun: true, targetSlug } : await cleanupTenant(targetSlug);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const result = await seedTenant();
console.log(JSON.stringify(result, null, 2));

if (!dryRun) {
  const proofDir = ensureProofDir(stamp);
  writeJson(path.join(proofDir, "manifest.json"), result);
  log(`wrote ${path.join(proofDir, "manifest.json")}`);
}
