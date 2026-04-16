/**
 * End-to-end test: 5 BookingConfirmed events (one per AI channel)
 * → CRM records created → jobs created and assigned to Jack Mason
 * → verify jobs appear in engineer diary
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// ── env ──────────────────────────────────────────────────────────────────────
const envRaw = readFileSync(".env.local", "utf-8");
function getEnv(key) {
  const match = envRaw.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const PLATFORM_SECRET = getEnv("PLATFORM_SHARED_SECRET");
const CRM_BASE = "http://localhost:3000";

const WORKSPACE_ID = "c7b7e675-12b8-4a45-a7c8-b811da90ee26"; // Jack Mason's tenant
const TENANT_ID = "c7b7e675-12b8-4a45-a7c8-b811da90ee26";
const TODAY = "2026-04-16";
const ENGINEER = "Jack Mason";

// ── 5 test bookings, one per channel ─────────────────────────────────────────
const BOOKINGS = [
  {
    channel: "webchat",
    conversationId: randomUUID(),
    customer: { name: "David Hughes",  phone: "07700100011", email: null,                    address: "12 Station Road",  city: "Uxbridge",   postcode: "UB8 1AA" },
    service:  { title: "Boiler Repair",         slot: "16 Apr 2026, 09:00–11:00", startAt: `${TODAY}T09:00:00Z`, endAt: `${TODAY}T11:00:00Z` },
  },
  {
    channel: "sms",
    conversationId: randomUUID(),
    customer: { name: "Karen Blake",   phone: "07700100022", email: null,                    address: "4 High Street",    city: "Hayes",      postcode: "UB3 2AA" },
    service:  { title: "Annual Boiler Service",  slot: "16 Apr 2026, 11:00–12:00", startAt: `${TODAY}T11:00:00Z`, endAt: `${TODAY}T12:00:00Z` },
  },
  {
    channel: "whatsapp",
    conversationId: randomUUID(),
    customer: { name: "Robert Walsh",  phone: "07700100033", email: null,                    address: "7 Park Avenue",    city: "Slough",     postcode: "SL1 3BB" },
    service:  { title: "Boiler Installation",    slot: "16 Apr 2026, 13:00–17:00", startAt: `${TODAY}T13:00:00Z`, endAt: `${TODAY}T17:00:00Z` },
  },
  {
    channel: "voice",
    conversationId: randomUUID(),
    customer: { name: "Emma Price",    phone: "07700100044", email: null,                    address: "3 London Road",    city: "Hillingdon", postcode: "UB10 4CC" },
    service:  { title: "Central Heating Repair", slot: "16 Apr 2026, 14:00–15:30", startAt: `${TODAY}T14:00:00Z`, endAt: `${TODAY}T15:30:00Z` },
  },
  {
    channel: "email",
    conversationId: randomUUID(),
    customer: { name: "James Foster",  phone: null,          email: "james.foster.test@ehs.example.com", address: "15 Church Lane", city: "Southall", postcode: "UB2 5DD" },
    service:  { title: "Hot Water Cylinder Replacement", slot: "16 Apr 2026, 15:30–18:00", startAt: `${TODAY}T15:30:00Z`, endAt: `${TODAY}T18:00:00Z` },
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function ok(label, data) { console.log(`  ✓ ${label}`, data ?? ""); }
function fail(label, err) { console.error(`  ✗ ${label}`, err); }

async function postEvent(booking) {
  const now = new Date().toISOString();
  const body = {
    event_id: randomUUID(),
    event_type: "BookingConfirmed",
    event_version: 1,
    workspace_id: WORKSPACE_ID,
    occurred_at: now,
    source_system: "agentic_runtime",
    idempotency_key: `e2e-test-${booking.conversationId}`,
    correlation_id: booking.conversationId,
    causation_id: null,
    aggregate: { type: "conversation", id: booking.conversationId },
    payload: {
      channel: booking.channel,
      customerName: booking.customer.name,
      customerPhone: booking.customer.phone,
      customerEmail: booking.customer.email,
      identity_phone: booking.customer.phone,
      identity_email: booking.customer.email,
      serviceAddressLine1: booking.customer.address,
      serviceCity: booking.customer.city,
      servicePostcode: booking.customer.postcode,
      booking_start_at: booking.service.startAt,
      booking_end_at: booking.service.endAt,
      booking_slot_label: booking.service.slot,
      job_title: booking.service.title,
      occurred_at: now,
    },
  };

  const res = await fetch(`${CRM_BASE}/api/platform/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-platform-shared-secret": PLATFORM_SECRET,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function dbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Accept-Profile": "crm",
    },
  });
  return res.json();
}

async function dbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Content-Profile": "crm",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${table} failed: ${JSON.stringify(json)}`);
  return Array.isArray(json) ? json[0] : json;
}

async function findCustomer(name, phone, email) {
  let url = `customers?tenant_id=eq.${TENANT_ID}&is_demo=eq.false&select=id,full_name,phone,email`;
  if (phone) url += `&phone=eq.${encodeURIComponent(phone)}`;
  else if (email) url += `&email=eq.${encodeURIComponent(email)}`;
  const rows = await dbGet(url);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

// ── main ─────────────────────────────────────────────────────────────────────
console.log("\n━━━  E2E Engineer Channel Test  ━━━\n");
console.log(`Workspace  ${WORKSPACE_ID}`);
console.log(`Tenant     ${TENANT_ID}`);
console.log(`Engineer   ${ENGINEER}`);
console.log(`Date       ${TODAY}\n`);

const results = [];

for (const booking of BOOKINGS) {
  console.log(`\n[${booking.channel.toUpperCase()}] ${booking.customer.name} — ${booking.service.title}`);

  // 1. Fire BookingConfirmed event
  let eventResult;
  try {
    eventResult = await postEvent(booking);
    ok("BookingConfirmed fired", `commands_enqueued=${eventResult.commands_enqueued}`);
  } catch (err) {
    fail("BookingConfirmed", err.message);
    results.push({ channel: booking.channel, status: "event_failed" });
    continue;
  }

  // 2. Find the created customer
  await new Promise((r) => setTimeout(r, 400)); // small delay for DB write
  const customer = await findCustomer(
    booking.customer.name,
    booking.customer.phone,
    booking.customer.email,
  );
  if (!customer) {
    fail("Customer not found in DB", `name=${booking.customer.name}`);
    results.push({ channel: booking.channel, status: "customer_missing" });
    continue;
  }
  ok("Customer created", `id=${customer.id}  name=${customer.full_name}`);

  // 3. Create a job assigned to Jack Mason for today
  let job;
  try {
    job = await dbPost("jobs", {
      tenant_id: TENANT_ID,
      customer_id: customer.id,
      title: booking.service.title,
      description: `Booked via AI ${booking.channel} channel. Slot: ${booking.service.slot}`,
      scheduled_date: TODAY,
      scheduled_time: booking.service.startAt.split("T")[1].slice(0, 5),
      duration_hours: null,
      status: "booked",
      assigned_engineer: ENGINEER,
      created_by: null,
      is_demo: false,
    });
    ok("Job created", `id=${job.id}  status=${job.status}`);
  } catch (err) {
    fail("Job creation", err.message);
    results.push({ channel: booking.channel, customer_id: customer.id, status: "job_failed" });
    continue;
  }

  results.push({
    channel: booking.channel,
    customer: customer.full_name,
    job_id: job.id,
    job_title: job.title,
    status: "ok",
  });
}

// ── verify jobs in engineer diary ─────────────────────────────────────────────
console.log("\n━━━  Verifying engineer diary  ━━━\n");
const engineerJobs = await dbGet(
  `jobs?tenant_id=eq.${TENANT_ID}&assigned_engineer=eq.${encodeURIComponent(ENGINEER)}&scheduled_date=eq.${TODAY}&is_demo=eq.false&select=id,title,status,scheduled_time&order=scheduled_time.asc`
);

console.log(`Jobs scheduled for ${ENGINEER} on ${TODAY}:`);
if (Array.isArray(engineerJobs) && engineerJobs.length > 0) {
  engineerJobs.forEach((j) => console.log(`  • [${j.scheduled_time ?? "--:--"}] ${j.title}  (${j.status})  ${j.id}`));
} else {
  console.log("  (none found)");
}

// ── summary ───────────────────────────────────────────────────────────────────
console.log("\n━━━  Summary  ━━━\n");
console.log(`${"Channel".padEnd(12)} ${"Customer".padEnd(20)} ${"Status".padEnd(15)} Job ID`);
console.log("─".repeat(80));
for (const r of results) {
  console.log(
    `${r.channel.padEnd(12)} ${(r.customer ?? "—").padEnd(20)} ${r.status.padEnd(15)} ${r.job_id ?? ""}`,
  );
}

const passed = results.filter((r) => r.status === "ok").length;
console.log(`\n${passed}/${BOOKINGS.length} channels passed end-to-end\n`);
