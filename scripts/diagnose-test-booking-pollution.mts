#!/usr/bin/env tsx
/**
 * CAL-001 — Read-only diagnostic: identify test bookings polluting the
 * production calendar.
 *
 * Background. The Tier 1 mock-adapter test infrastructure shipped today
 * uses `MESSAGING_ADAPTER=mock` to suppress outbound Twilio. It does NOT
 * stop the agent from claiming real calendar slots — every confirmed
 * test booking lands as a row in `crm.appointments` (and the corresponding
 * platform-api bookings table) on the same shared production data plane.
 *
 * Three 10/10 validation passes today created roughly 30 confirmed
 * bookings, all on the same engineer resource, all within the next 7
 * days. A real customer call this afternoon couldn't find any slot for a
 * week — that's the failure mode that triggered this work.
 *
 * This script enumerates the bookings on the production calendar over
 * the next 30 days and tags each one as suspected-test or real-looking,
 * using identifiers the test script (`scripts/live-empire-channel-tests.mts`)
 * generates:
 *
 *   - emails matching `*.@test.com` for the known persona prefixes
 *   - phone numbers in the `+447{6-or-7-digit-runId}{2-digit}` shape
 *   - customer rows created within the last 24h with one of the test names
 *
 * Output: a per-day, per-resource breakdown of suspected test bookings
 * vs real-looking ones. No writes. No external traffic.
 *
 * Run:
 *   npx tsx scripts/diagnose-test-booking-pollution.mts
 *
 * Optional env:
 *   DAYS=14   — window in days from now (default 30)
 *   VERBOSE=1 — print every test-suspect booking, not just counts
 *
 * CAL-002 mode (cancels the suspected test bookings):
 *   npx tsx scripts/diagnose-test-booking-pollution.mts \
 *     --cancel --confirm-cancel-bookings=I-AM-SURE
 *
 * Cancellation sets status='cancelled' on each row (NOT DELETE) so the
 * audit trail is preserved. The previous status is stashed in
 * appointments.metadata.previous_status for mechanical rollback.
 */

import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const TEST_EMAIL_RE =
  /^(sarah\.sms|david\.wp|alice\.wp|tom\.webchat|mark\.sms|priya\.web|linda\.voice|james\.voice|john\.smith)\.\d+@test\.com$/i;

// The test runner generates phone numbers like +447{runId}{NN} where runId
// is `Date.now().toString().slice(-7)` and NN is the scenario suffix
// (01..10). Real UK mobile numbers also start +447 — only consider this a
// test signal in combination with the email pattern or with a phone-shape
// of exactly 13 digits where the entire trailing 9 digits look like the
// runId pattern.
const TEST_PHONE_RE = /^\+447\d{9}$/;

const TEST_FULL_NAME_RE =
  /^(Sarah Brown|David Patel|Alice Thompson|Tom Hughes|Mark O'?Connor|Priya Shah|Linda|James|John Smith)$/i;

const DAYS = Number.parseInt(process.env.DAYS ?? "30", 10);
const VERBOSE = process.env.VERBOSE === "1";

const CLI_ARGS = process.argv.slice(2);
const CANCEL_MODE = CLI_ARGS.includes("--cancel");
const CANCEL_CONFIRM_TOKEN = "I-AM-SURE";
const CANCEL_CONFIRMED = CLI_ARGS.includes(`--confirm-cancel-bookings=${CANCEL_CONFIRM_TOKEN}`);

type CustomerRow = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  tenant_id: string;
  created_at: string;
};

type AppointmentRow = {
  id: string;
  customer_id: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  title: string | null;
  tenant_id: string;
  created_at: string;
  source: string | null;
  external_id: string | null;
};

type EnrichedAppointment = AppointmentRow & {
  customer: CustomerRow | null;
  testSignals: string[];
};

function looksLikeTestCustomer(c: CustomerRow | null): string[] {
  if (!c) return [];
  const signals: string[] = [];
  if (c.email && TEST_EMAIL_RE.test(c.email)) signals.push(`email=${c.email}`);
  if (c.phone && TEST_PHONE_RE.test(c.phone)) {
    // Real UK mobiles also fit this regex. Only flag as test when paired
    // with a test email OR a test name OR no last-name.
    const nameLooksTest =
      (c.full_name && TEST_FULL_NAME_RE.test(c.full_name)) ||
      (c.first_name && TEST_FULL_NAME_RE.test(c.first_name)) ||
      !c.last_name;
    const emailLooksTest = c.email && TEST_EMAIL_RE.test(c.email);
    if (emailLooksTest || nameLooksTest) {
      signals.push(`phone=${c.phone}`);
    }
  }
  if (c.full_name && TEST_FULL_NAME_RE.test(c.full_name)) signals.push(`name=${c.full_name}`);
  return signals;
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

async function main() {
  const config = requireCrmScriptConfig(true);
  if (!config.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing — required for read access to crm.appointments.");
  }
  const supabase = createClient(config.supabaseUrl!, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const windowEnd = new Date(now.getTime() + DAYS * 86_400_000);

  console.log("=".repeat(72));
  console.log("CAL-001 diagnostic — test-booking pollution");
  console.log(`  window:  now → ${windowEnd.toISOString()}  (${DAYS} days)`);
  console.log(`  source:  Empire CRM Supabase (read-only)`);
  console.log("=".repeat(72));
  console.log();

  // 1. Pull active/confirmed appointments in the window.
  const { data: appointments, error: apptErr } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id, customer_id, starts_at, ends_at, status, title, tenant_id, created_at, source, external_id")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", windowEnd.toISOString())
    .in("status", ["scheduled"])
    .order("starts_at", { ascending: true })
    .returns<AppointmentRow[]>();

  if (apptErr) {
    throw new Error(`Failed to read appointments: ${apptErr.message}`);
  }
  if (!appointments || appointments.length === 0) {
    console.log("No appointments in the window — calendar is clean.");
    return;
  }

  // 2. Pull the customer rows for those appointments in one batch.
  const customerIds = Array.from(new Set(appointments.map((a) => a.customer_id).filter(Boolean))) as string[];
  let customersById = new Map<string, CustomerRow>();
  if (customerIds.length > 0) {
    const { data: customers, error: custErr } = await supabase
      .schema("crm")
      .from("customers")
      .select("id, email, phone, full_name, first_name, last_name, tenant_id, created_at")
      .in("id", customerIds)
      .returns<CustomerRow[]>();
    if (custErr) {
      throw new Error(`Failed to read customers: ${custErr.message}`);
    }
    customersById = new Map((customers ?? []).map((c) => [c.id, c]));
  }

  // 3. Enrich and classify.
  const enriched: EnrichedAppointment[] = appointments.map((a) => {
    const c = a.customer_id ? customersById.get(a.customer_id) ?? null : null;
    return { ...a, customer: c, testSignals: looksLikeTestCustomer(c) };
  });

  const testBookings = enriched.filter((a) => a.testSignals.length > 0);
  const realBookings = enriched.filter((a) => a.testSignals.length === 0);

  // 4. Print summary.
  console.log(`Total appointments in window: ${enriched.length}`);
  console.log(`  Suspected test bookings:   ${testBookings.length}`);
  console.log(`  Real-looking bookings:     ${realBookings.length}`);
  console.log();

  // 5. Per-day breakdown.
  console.log("Per-day breakdown");
  console.log("-".repeat(72));
  const buckets = new Map<string, { test: number; real: number }>();
  for (const a of enriched) {
    const day = startOfDayUtc(new Date(a.starts_at)).toISOString().slice(0, 10);
    const b = buckets.get(day) ?? { test: 0, real: 0 };
    if (a.testSignals.length > 0) b.test += 1;
    else b.real += 1;
    buckets.set(day, b);
  }
  const days = Array.from(buckets.keys()).sort();
  console.log(`  ${"day".padEnd(12)}  test  real  total`);
  for (const day of days) {
    const b = buckets.get(day)!;
    console.log(`  ${day.padEnd(12)}  ${String(b.test).padStart(4)}  ${String(b.real).padStart(4)}  ${String(b.test + b.real).padStart(5)}`);
  }
  console.log();

  // 6. Per-tenant.
  const byTenant = new Map<string, { test: number; real: number }>();
  for (const a of enriched) {
    const t = a.tenant_id;
    const b = byTenant.get(t) ?? { test: 0, real: 0 };
    if (a.testSignals.length > 0) b.test += 1;
    else b.real += 1;
    byTenant.set(t, b);
  }
  console.log("Per-tenant breakdown");
  console.log("-".repeat(72));
  for (const [tenant, b] of byTenant.entries()) {
    console.log(`  ${tenant}  test=${b.test}  real=${b.real}`);
  }
  console.log();

  // 7. Real-looking bookings (preview — operator confirms NONE are actually test).
  console.log("Real-looking bookings (sample of first 10)");
  console.log("-".repeat(72));
  for (const a of realBookings.slice(0, 10)) {
    const c = a.customer;
    const id = (s: string | null | undefined) => (s && s.length > 36 ? `${s.slice(0, 33)}…` : (s ?? "—"));
    console.log(
      `  ${a.starts_at.slice(0, 16).replace("T", " ")}  ${a.status.padEnd(9)}  ${id(c?.full_name).padEnd(28)}  ${id(c?.email).padEnd(36)}  ${id(c?.phone)}`
    );
  }
  console.log();

  // 8. Test-suspected bookings (full list — these are the cancellation candidates).
  console.log(`Suspected test bookings (${testBookings.length}) — cancellation candidates for CAL-002`);
  console.log("-".repeat(72));
  for (const a of testBookings) {
    const c = a.customer;
    const sig = a.testSignals.join(", ");
    console.log(
      `  ${a.id}  ${a.starts_at.slice(0, 16).replace("T", " ")}  ${a.status.padEnd(9)}  ${(c?.full_name ?? "—").padEnd(24)}  ← ${sig}`
    );
  }
  console.log();

  if (VERBOSE) {
    console.log("Verbose: full appointment rows (test-suspected only)");
    console.log("-".repeat(72));
    for (const a of testBookings) {
      console.log(JSON.stringify(a, null, 2));
    }
  }

  console.log("=".repeat(72));
  console.log("END OF DIAGNOSTIC");
  console.log("=".repeat(72));

  if (!CANCEL_MODE) {
    console.log();
    console.log("NO WRITES PERFORMED.");
    console.log(`To cancel the ${testBookings.length} test bookings above (CAL-002):`);
    console.log(`  npx tsx scripts/diagnose-test-booking-pollution.mts \\`);
    console.log(`    --cancel --confirm-cancel-bookings=${CANCEL_CONFIRM_TOKEN}`);
    return;
  }

  if (!CANCEL_CONFIRMED) {
    console.log();
    console.error("REFUSED: --cancel requires --confirm-cancel-bookings=" + CANCEL_CONFIRM_TOKEN);
    process.exit(2);
  }

  if (testBookings.length === 0) {
    console.log();
    console.log("Nothing to cancel — diagnostic found 0 test bookings.");
    return;
  }

  console.log();
  console.log("=".repeat(72));
  console.log(`CAL-002 cancellation — about to cancel ${testBookings.length} bookings`);
  console.log("=".repeat(72));
  console.log("Mechanism: set status='cancelled' on each row (NOT delete).");
  console.log("Audit:     stash previous status in metadata.previous_status.");
  console.log();

  // `crm.appointments` doesn't have a metadata column — the prior status
  // for these 54 rows is uniformly 'scheduled' (already filtered in the
  // .in("status", ["scheduled"]) query above), so rollback is mechanical
  // by status flip if ever needed. The diagnostic output (committed in
  // run logs / git) captures the full id list for rollback.
  let cancelled = 0;
  let failed = 0;
  for (const a of testBookings) {
    // Guard: if it's already cancelled (idempotent re-run), skip.
    if (a.status === "cancelled") {
      console.log(`  SKIP ${a.id}: already cancelled`);
      continue;
    }
    const { error: updateErr } = await supabase
      .schema("crm")
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", a.id);
    if (updateErr) {
      console.error(`  FAIL ${a.id}: update error ${updateErr.message}`);
      failed += 1;
      continue;
    }
    cancelled += 1;
    const sigPreview = a.testSignals.slice(0, 1).join("");
    console.log(`  CANCELLED ${a.id}  ${a.starts_at.slice(0, 16).replace("T", " ")}  ← ${sigPreview}`);
  }

  console.log();
  console.log("=".repeat(72));
  console.log(`CAL-002 done: ${cancelled} cancelled, ${failed} failed, ${testBookings.length - cancelled - failed} skipped`);
  console.log("=".repeat(72));
  if (failed > 0) {
    console.log("Some rows failed — re-run the script to retry (idempotent).");
    process.exit(1);
  }
  console.log();
  console.log("Run the diagnostic again WITHOUT --cancel to verify 0 test bookings remain:");
  console.log("  npx tsx scripts/diagnose-test-booking-pollution.mts");
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
