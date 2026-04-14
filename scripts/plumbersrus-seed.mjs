/**
 * Plumbersrus.ai — Full Tenant Seed Script
 * Creates tenant, 12 engineers, 25 customers, 30 jobs, quotes, invoices, expenses, notes.
 * Run: node scripts/plumbersrus-seed.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_SLUG = "plumbersrus-ai";
const OWNER_EMAIL = "owner@plumbersrus.ai";
const OWNER_PASSWORD = "PlumbersRus-Demo-2026!";

// ─── ENGINEERS ───────────────────────────────────────────────────────────────

const ENGINEERS = [
  { email: "jack.mason@plumbersrus.ai",    fullName: "Jack Mason",    phone: "07700 100 001", role: "engineer",   payType: "day-rate",  agreedHours: "Mon-Fri 07:30-17:00" },
  { email: "priya.nair@plumbersrus.ai",    fullName: "Priya Nair",    phone: "07700 100 002", role: "engineer",   payType: "day-rate",  agreedHours: "Tue-Sat 08:00-17:00" },
  { email: "tom.walsh@plumbersrus.ai",     fullName: "Tom Walsh",     phone: "07700 100 003", role: "engineer",   payType: "day-rate",  agreedHours: "Mon-Fri 07:30-17:00" },
  { email: "leila.osei@plumbersrus.ai",    fullName: "Leila Osei",    phone: "07700 100 004", role: "engineer",   payType: "salary",    agreedHours: "Mon-Fri 08:00-16:30" },
  { email: "marcus.bell@plumbersrus.ai",   fullName: "Marcus Bell",   phone: "07700 100 005", role: "engineer",   payType: "day-rate",  agreedHours: "Mon-Sat 07:00-16:00" },
  { email: "suki.patel@plumbersrus.ai",    fullName: "Suki Patel",    phone: "07700 100 006", role: "engineer",   payType: "day-rate",  agreedHours: "Mon-Fri 08:30-17:30" },
  { email: "ryan.coles@plumbersrus.ai",    fullName: "Ryan Coles",    phone: "07700 100 007", role: "engineer",   payType: "day-rate",  agreedHours: "Tue-Sat 07:30-17:00" },
  { email: "amara.diop@plumbersrus.ai",    fullName: "Amara Diop",    phone: "07700 100 008", role: "engineer",   payType: "day-rate",  agreedHours: "Mon-Fri 08:00-17:00" },
  { email: "dean.harris@plumbersrus.ai",   fullName: "Dean Harris",   phone: "07700 100 009", role: "engineer",   payType: "salary",    agreedHours: "Mon-Fri 07:30-16:30" },
  { email: "yasmin.khan@plumbersrus.ai",   fullName: "Yasmin Khan",   phone: "07700 100 010", role: "engineer",   payType: "day-rate",  agreedHours: "Mon-Sat 08:00-17:00" },
  { email: "ops.manager@plumbersrus.ai",   fullName: "Claire Sutton", phone: "07700 100 011", role: "management", payType: "salary",    agreedHours: "Mon-Fri 09:00-17:30" },
  { email: "accounts@plumbersrus.ai",      fullName: "Neil Farrow",   phone: "07700 100 012", role: "accounts",   payType: "salary",    agreedHours: "Mon-Fri 09:00-17:00" },
];

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { full_name: "Oliver Hartley",   phone: "07800 200 001", email: "o.hartley@gmail.com",       address_line1: "4 Maple Close",        city: "Hayes",        postcode: "UB3 1PQ", notes: "Friendly, prefers WhatsApp." },
  { full_name: "Fatima Begum",     phone: "07800 200 002", email: "fatima.begum@hotmail.co.uk", address_line1: "12 Sovereign Way",     city: "Uxbridge",     postcode: "UB8 2RA", notes: "Rented flat — landlord is Mr. Begum Sr." },
  { full_name: "Chris Doyle",      phone: "07800 200 003", email: "cdoyle@icloud.com",          address_line1: "88 Station Road",      city: "Harrow",       postcode: "HA1 2XZ", notes: "Boiler very old — check GC number on visit." },
  { full_name: "Sunita Sharma",    phone: "07800 200 004", email: "sunita.s@outlook.com",       address_line1: "32 Park Avenue",       city: "Slough",       postcode: "SL1 3TF", notes: "Has dogs — gate is padlocked." },
  { full_name: "Gary Malone",      phone: "07800 200 005", email: "garym74@gmail.com",          address_line1: "7 Elmwood Drive",      city: "Ruislip",      postcode: "HA4 9JK", notes: "Annual service customer. Very loyal." },
  { full_name: "Nadia Yusuf",      phone: "07800 200 006", email: "n.yusuf@gmail.com",          address_line1: "15 Birch Lane",        city: "Northolt",     postcode: "UB5 4HG", notes: "Mortgage survey required before work." },
  { full_name: "Paul Griffiths",   phone: "07800 200 007", email: "p.griffiths@live.co.uk",     address_line1: "3 Rosewood Terrace",   city: "Wembley",      postcode: "HA9 7LM", notes: "Extension build — new bathroom fitout." },
  { full_name: "Aisha Okafor",     phone: "07800 200 008", email: "aisha.ok@gmail.com",         address_line1: "21 Chestnut Road",     city: "Southall",     postcode: "UB1 1NB", notes: "Call before arriving — works nights." },
  { full_name: "Daniel Foley",     phone: "07800 200 009", email: "d.foley@yahoo.co.uk",        address_line1: "56 Kings Crescent",    city: "Windsor",      postcode: "SL4 2TW", notes: "Commercial property — invoice to Foley Ltd." },
  { full_name: "Mia Thornton",     phone: "07800 200 010", email: "mia.thornton@gmail.com",     address_line1: "9 Acorn Close",        city: "Uxbridge",     postcode: "UB10 0DX", notes: "New build — snagging list outstanding." },
  { full_name: "Rahim Chowdhury",  phone: "07800 200 011", email: "rahim.c@outlook.com",        address_line1: "44 Jubilee Road",      city: "Hayes",        postcode: "UB3 2LQ", notes: "3 rental properties managed together." },
  { full_name: "Lucy Brennan",     phone: "07800 200 012", email: "lucyb99@icloud.com",         address_line1: "2 Holly Court",        city: "Denham",       postcode: "UB9 5RH", notes: "High-end property — take shoes off inside." },
  { full_name: "Steve Whittle",    phone: "07800 200 013", email: "s.whittle@gmail.com",        address_line1: "60 Ferndale Way",      city: "Iver",         postcode: "SL0 9LT", notes: "Previously had leak — check all pipework." },
  { full_name: "Priyanka Desai",   phone: "07800 200 014", email: "priyanka.d@hotmail.com",     address_line1: "18 Garden Row",        city: "Greenford",    postcode: "UB6 8PJ", notes: "Finance enquiry raised — awaiting approval." },
  { full_name: "Matt Connelly",    phone: "07800 200 015", email: "matt.connelly@gmail.com",    address_line1: "77 Highfield Avenue",  city: "Rickmansworth", postcode: "WD3 2AH", notes: "Referral from Gary Malone." },
  { full_name: "Sandra Blake",     phone: "07800 200 016", email: "s.blake@outlook.com",        address_line1: "5 Lilac Gardens",      city: "Hillingdon",   postcode: "UB10 9TP", notes: "Pensioner — patient with explanations." },
  { full_name: "Kwame Asante",     phone: "07800 200 017", email: "k.asante@gmail.com",         address_line1: "30 Orchard Road",      city: "Ealing",       postcode: "W5 3NQ",  notes: "Wants full bathroom replacement quote." },
  { full_name: "Emma Sutcliffe",   phone: "07800 200 018", email: "emma.s@icloud.com",          address_line1: "14 Cedar Mews",        city: "Beaconsfield", postcode: "HP9 1EQ", notes: "Underfloor heating survey requested." },
  { full_name: "Bashir Hussain",   phone: "07800 200 019", email: "b.hussain@gmail.com",        address_line1: "9 Millbrook Court",    city: "Staines",      postcode: "TW18 3LP", notes: "Has Vaillant — warranty still valid." },
  { full_name: "Tessa Whitmore",   phone: "07800 200 020", email: "tessa.w@yahoo.co.uk",        address_line1: "23 Brook Street",      city: "Maidenhead",   postcode: "SL6 1EX", notes: "Emergency callout customer — loyal." },
  { full_name: "Joe Akerman",      phone: "07800 200 021", email: "j.akerman@live.co.uk",       address_line1: "6 The Pines",          city: "Gerrards Cross", postcode: "SL9 7RE", notes: "Just moved in — full system check wanted." },
  { full_name: "Divya Mehta",      phone: "07800 200 022", email: "divya.mehta@gmail.com",      address_line1: "38 Birchwood Close",   city: "Watford",      postcode: "WD17 4PP", notes: "Wants smart thermostat fitted same visit." },
  { full_name: "Kevin Shaw",       phone: "07800 200 023", email: "kev.shaw@gmail.com",         address_line1: "11 Newlands Avenue",   city: "Uxbridge",     postcode: "UB8 3RN", notes: "Bathroom strip-out and refit — 2 weeks' work." },
  { full_name: "Grace Ofosu",      phone: "07800 200 024", email: "g.ofosu@outlook.com",        address_line1: "55 Windmill Lane",     city: "Southall",     postcode: "UB2 5DG", notes: "Low water pressure issue ongoing." },
  { full_name: "Ian Pearce",       phone: "07800 200 025", email: "ian.pearce@hotmail.co.uk",   address_line1: "17 Sycamore Place",    city: "Hayes",        postcode: "UB4 0RF", notes: "Landlord — 4 properties, needs CP12s annually." },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(msg) { console.log(msg); }

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isoAgo(days, hours = 9) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
}

async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser(email, password, fullName) {
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) throw new Error(error?.message ?? `Failed to create ${email}`);
    user = data.user;
    log(`  created auth user: ${email}`);
  } else {
    log(`  reused auth user: ${email}`);
  }
  return user;
}

async function waitForProfile(userId, tenantId) {
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.schema("crm").from("user_profiles").select("*")
      .eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for profile: user=${userId} tenant=${tenantId}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

log("\n━━━ Plumbersrus.ai Tenant Seed ━━━\n");

// 1. Find or create tenant
log("1. Provisioning tenant...");
let { data: existingTenant } = await admin.schema("crm").from("tenants").select("*").eq("slug", TENANT_SLUG).maybeSingle();

let tenantId;
if (existingTenant) {
  tenantId = existingTenant.id;
  log(`   tenant already exists: ${tenantId}`);
} else {
  const { data: newTenant, error } = await admin.schema("crm").from("tenants")
    .insert({ name: "Plumbersrus.ai", slug: TENANT_SLUG, status: "active" })
    .select("*").single();
  if (error || !newTenant) throw new Error(error?.message ?? "Failed to create tenant");
  tenantId = newTenant.id;
  log(`   created tenant: ${tenantId}`);
}

// Branding + settings
await admin.schema("crm").from("tenant_branding").upsert({
  tenant_id: tenantId,
  business_name: "Plumbersrus.ai",
  crm_display_name: "Plumbersrus CRM",
  primary_phone: "01895 999 111",
  support_email: "hello@plumbersrus.ai",
  accent_color: "#2563eb",
}, { onConflict: "tenant_id" });

await admin.schema("crm").from("tenant_settings").upsert({
  tenant_id: tenantId,
  legal_name: "Plumbersrus.ai Ltd",
  vat_registration_number: "GB 987 654 321",
  gas_safe_number: "GS-556677",
}, { onConflict: "tenant_id" });

log("   branding and settings saved");

// 2. Owner account
log("\n2. Creating owner account...");
const ownerUser = await ensureUser(OWNER_EMAIL, OWNER_PASSWORD, "Alex Rivers");

// Wait for trigger-generated profile and update it
for (let i = 0; i < 20; i++) {
  const { data } = await admin.schema("crm").from("user_profiles").select("*").eq("user_id", ownerUser.id).maybeSingle();
  if (data) break;
  await new Promise((r) => setTimeout(r, 400));
}

await admin.schema("crm").from("tenant_memberships").upsert({
  tenant_id: tenantId,
  user_id: ownerUser.id,
  role: "admin",
  active: true,
  is_owner: true,
  is_demo: false,
}, { onConflict: "tenant_id,user_id" });

await admin.schema("crm").from("user_profiles").upsert({
  tenant_id: tenantId,
  user_id: ownerUser.id,
  role: "admin",
  full_name: "Alex Rivers",
  phone: "07700 000 001",
  email: OWNER_EMAIL,
  active: true,
  is_demo: false,
  demo_scenario_key: null,
}, { onConflict: "tenant_id,user_id" });

log(`   owner: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);

// 3. Engineers
log("\n3. Creating 12 engineers/staff...");
const engineerProfiles = [];

for (const eng of ENGINEERS) {
  const user = await ensureUser(eng.email, OWNER_PASSWORD, eng.fullName);

  await admin.schema("crm").from("tenant_memberships").upsert({
    tenant_id: tenantId,
    user_id: user.id,
    role: eng.role,
    active: true,
    is_owner: false,
    is_demo: false,
  }, { onConflict: "tenant_id,user_id" });

  await admin.schema("crm").from("user_profiles").upsert({
    tenant_id: tenantId,
    user_id: user.id,
    role: eng.role,
    full_name: eng.fullName,
    phone: eng.phone,
    email: eng.email,
    agreed_hours: eng.agreedHours,
    pay_type: eng.payType,
    active: true,
    is_demo: false,
    demo_scenario_key: null,
  }, { onConflict: "tenant_id,user_id" });

  const profile = await waitForProfile(user.id, tenantId);
  engineerProfiles.push({ ...eng, profileId: profile.id });
}

log(`   ${ENGINEERS.length} staff members created`);

// 4. Customers
log("\n4. Creating 25 customers...");
const customerIds = [];

for (const c of CUSTOMERS) {
  const id = uuid();
  const { error } = await admin.schema("crm").from("customers").upsert({
    id,
    tenant_id: tenantId,
    full_name: c.full_name,
    phone: c.phone,
    email: c.email,
    address_line1: c.address_line1,
    city: c.city,
    postcode: c.postcode,
    notes: c.notes,
    archived: false,
  }, { onConflict: "id" });
  if (error) log(`   WARN customer ${c.full_name}: ${error.message}`);
  else customerIds.push(id);
}

log(`   ${customerIds.length} customers created`);

// 5. Services and job types
log("\n5. Seeding services and job types...");
const services = [
  { id: uuid(), slug: "plumbing",        name: "Plumbing",        active: true },
  { id: uuid(), slug: "heating",         name: "Heating",         active: true },
  { id: uuid(), slug: "bathrooms",       name: "Bathrooms",       active: true },
  { id: uuid(), slug: "gas",             name: "Gas Work",        active: true },
];

for (const s of services) {
  await admin.schema("crm").from("services").upsert({ ...s, tenant_id: tenantId }, { onConflict: "id" });
}

const jobTypes = [
  { id: uuid(), service_slug: "plumbing", slug: "leak-repair",         name: "Leak Repair" },
  { id: uuid(), service_slug: "plumbing", slug: "pipe-replacement",    name: "Pipe Replacement" },
  { id: uuid(), service_slug: "plumbing", slug: "power-flush",         name: "Power Flush" },
  { id: uuid(), service_slug: "heating",  slug: "boiler-repair",       name: "Boiler Repair" },
  { id: uuid(), service_slug: "heating",  slug: "boiler-installation", name: "Boiler Installation" },
  { id: uuid(), service_slug: "heating",  slug: "annual-service",      name: "Annual Service" },
  { id: uuid(), service_slug: "bathrooms",slug: "bathroom-refit",      name: "Bathroom Refit" },
  { id: uuid(), service_slug: "bathrooms",slug: "shower-installation", name: "Shower Installation" },
  { id: uuid(), service_slug: "gas",      slug: "cp12-certificate",    name: "CP12 Gas Safety Certificate" },
  { id: uuid(), service_slug: "gas",      slug: "gas-appliance-check", name: "Gas Appliance Check" },
];

for (const jt of jobTypes) {
  const service = services.find((s) => s.slug === jt.service_slug);
  await admin.schema("crm").from("job_types").upsert({
    id: jt.id, tenant_id: tenantId, service_id: service?.id ?? null,
    slug: jt.slug, name: jt.name, active: true,
  }, { onConflict: "id" });
}
log(`   ${services.length} services, ${jobTypes.length} job types`);

// 6. Jobs + quotes + invoices
log("\n6. Creating 30 jobs with quotes, invoices, expenses, and notes...");

const JOB_TEMPLATES = [
  { title: "Boiler Repair — No Hot Water",         status: "completed", jobTypeSlug: "boiler-repair",         repairDesc: "E119 error — diverter valve replaced.",     amount: 285,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 30 },
  { title: "Annual Boiler Service + CP12",          status: "completed", jobTypeSlug: "annual-service",        repairDesc: "Full service and landlord cert issued.",     amount: 120,  vatRate: 0,    hasQuote: false, invStatus: "paid",   daysAgoStart: 25 },
  { title: "Power Flush — 9 Rad System",           status: "invoiced",  jobTypeSlug: "power-flush",           repairDesc: "Sludge removal, inhibitor dosed.",           amount: 520,  vatRate: 0.20, hasQuote: true,  invStatus: "unpaid", daysAgoStart: 20 },
  { title: "Bathroom Refit — Full Strip & Refit",  status: "in_progress", jobTypeSlug: "bathroom-refit",      repairDesc: "Day 3 of 5 — tiles 60% done.",              amount: 3800, vatRate: 0.20, hasQuote: true,  invStatus: null,     daysAgoStart: 5  },
  { title: "New Boiler Installation — Viessmann",  status: "booked",    jobTypeSlug: "boiler-installation",   repairDesc: "Full combi swap, back boiler removal.",      amount: 2400, vatRate: 0,    hasQuote: true,  invStatus: null,     daysAgoStart: -3 },
  { title: "Leak Repair — Under Kitchen Sink",     status: "completed", jobTypeSlug: "leak-repair",           repairDesc: "Push-fit joint failure, replaced.",          amount: 95,   vatRate: 0.20, hasQuote: false, invStatus: "paid",   daysAgoStart: 45 },
  { title: "Shower Installation — Mira Sport",     status: "completed", jobTypeSlug: "shower-installation",   repairDesc: "Electric shower fitted, tested, certified.", amount: 340,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 60 },
  { title: "CP12 Gas Safety Certificate",          status: "completed", jobTypeSlug: "cp12-certificate",      repairDesc: "2 appliances checked, cert issued same day.",amount: 80,   vatRate: 0,    hasQuote: false, invStatus: "paid",   daysAgoStart: 15 },
  { title: "Gas Hob Supply & Installation",        status: "completed", jobTypeSlug: "gas-appliance-check",   repairDesc: "Rangemaster hob supply and fit.",            amount: 420,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 50 },
  { title: "Boiler Service — Annual Check",        status: "booked",    jobTypeSlug: "annual-service",        repairDesc: "Scheduled for next Monday.",                 amount: 95,   vatRate: 0,    hasQuote: false, invStatus: null,     daysAgoStart: -7 },
  { title: "Bathroom Refit — En-Suite",            status: "enquiry",   jobTypeSlug: "bathroom-refit",        repairDesc: "Survey booked — quote to follow.",          amount: 4200, vatRate: 0.20, hasQuote: false, invStatus: null,     daysAgoStart: -1 },
  { title: "Pipe Replacement — Loft Tank Feed",    status: "completed", jobTypeSlug: "pipe-replacement",      repairDesc: "22mm copper to 15mm flexi — 6m run.",       amount: 180,  vatRate: 0.20, hasQuote: false, invStatus: "paid",   daysAgoStart: 35 },
  { title: "Power Flush — 12 Rad System",         status: "completed", jobTypeSlug: "power-flush",           repairDesc: "MagnaCleanse fitted. Excellent flow.",       amount: 680,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 40 },
  { title: "Boiler Repair — Pressure Loss",        status: "in_progress", jobTypeSlug: "boiler-repair",       repairDesc: "Expansion vessel suspect — testing.",       amount: 220,  vatRate: 0.20, hasQuote: false, invStatus: null,     daysAgoStart: 1  },
  { title: "Gas Safety Check — 3 Appliances",      status: "completed", jobTypeSlug: "gas-appliance-check",   repairDesc: "Boiler, hob, fire — all passed.",            amount: 120,  vatRate: 0,    hasQuote: false, invStatus: "paid",   daysAgoStart: 18 },
  { title: "Shower Pump Replacement",              status: "completed", jobTypeSlug: "shower-installation",   repairDesc: "Stuart Turner Showermate fitted.",           amount: 260,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 55 },
  { title: "Underfloor Heating Survey",            status: "completed", jobTypeSlug: "boiler-installation",   repairDesc: "Survey done — 3-zone UFH quotation sent.",  amount: 0,    vatRate: 0,    hasQuote: true,  invStatus: null,     daysAgoStart: 8  },
  { title: "Leak Repair — Bathroom Radiator",      status: "completed", jobTypeSlug: "leak-repair",           repairDesc: "TRV joint failure — reseated and tested.",   amount: 110,  vatRate: 0.20, hasQuote: false, invStatus: "paid",   daysAgoStart: 28 },
  { title: "Boiler Installation — Worcester 4000", status: "completed", jobTypeSlug: "boiler-installation",   repairDesc: "2-day install, MagnaClean, smart stat.",     amount: 2950, vatRate: 0,    hasQuote: true,  invStatus: "paid",   daysAgoStart: 70 },
  { title: "Annual Service + Flush",               status: "completed", jobTypeSlug: "annual-service",        repairDesc: "Service + mini power flush — passed.",      amount: 160,  vatRate: 0,    hasQuote: false, invStatus: "paid",   daysAgoStart: 90 },
  { title: "Bathroom Refit — Main Bathroom",       status: "booked",    jobTypeSlug: "bathroom-refit",        repairDesc: "5-day job starts next week.",               amount: 5200, vatRate: 0.20, hasQuote: true,  invStatus: null,     daysAgoStart: -5 },
  { title: "CP12 Certificate — HMO Property",     status: "completed", jobTypeSlug: "cp12-certificate",      repairDesc: "5 appliances — cert issued.",                amount: 220,  vatRate: 0,    hasQuote: false, invStatus: "paid",   daysAgoStart: 12 },
  { title: "Gas Leak Investigation",               status: "completed", jobTypeSlug: "leak-repair",           repairDesc: "Meter tail joint — reseated and tested.",   amount: 145,  vatRate: 0.20, hasQuote: false, invStatus: "paid",   daysAgoStart: 22 },
  { title: "Smart Thermostat Installation",        status: "completed", jobTypeSlug: "boiler-repair",         repairDesc: "Nest 3rd Gen fitted and configured.",        amount: 195,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 32 },
  { title: "Pipe Lagging — Loft + Garage",        status: "enquiry",   jobTypeSlug: "pipe-replacement",      repairDesc: "Enquiry — survey to be booked.",            amount: 0,    vatRate: 0,    hasQuote: false, invStatus: null,     daysAgoStart: 0  },
  { title: "Power Flush — 7 Rad System",          status: "completed", jobTypeSlug: "power-flush",           repairDesc: "Inhibitor and MagnaClean fitted.",           amount: 440,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 65 },
  { title: "Boiler Service + Landlord Cert",       status: "completed", jobTypeSlug: "cp12-certificate",      repairDesc: "Service + CP12, cert emailed to landlord.", amount: 130,  vatRate: 0,    hasQuote: false, invStatus: "paid",   daysAgoStart: 48 },
  { title: "Shower Installation — Thermostatic",  status: "booked",    jobTypeSlug: "shower-installation",   repairDesc: "Grohe Euphoria system — parts on order.",   amount: 680,  vatRate: 0.20, hasQuote: true,  invStatus: null,     daysAgoStart: -2 },
  { title: "Radiator Addition — New Extension",   status: "completed", jobTypeSlug: "pipe-replacement",      repairDesc: "2x rads added, balanced whole system.",     amount: 380,  vatRate: 0.20, hasQuote: true,  invStatus: "paid",   daysAgoStart: 38 },
  { title: "Boiler Repair — Ignition Fault",      status: "in_progress", jobTypeSlug: "boiler-repair",       repairDesc: "Igniter replaced, awaiting 2nd test fire.", amount: 195,  vatRate: 0.20, hasQuote: false, invStatus: null,     daysAgoStart: 2  },
];

await waitForProfile(ownerUser.id, tenantId);
const createdBy = ownerUser.id;
const invCounter = { n: 1000 };
const quoteCounter = { n: 200 };

let jobsCreated = 0;
let quotesCreated = 0;
let invoicesCreated = 0;
let notesCreated = 0;
let expensesCreated = 0;

const engNames = ENGINEERS.filter((e) => e.role === "engineer").map((e) => e.fullName);

for (let i = 0; i < JOB_TEMPLATES.length; i++) {
  const tmpl = JOB_TEMPLATES[i];
  const customerId = customerIds[i % customerIds.length];
  const jobType = jobTypes.find((jt) => jt.slug === tmpl.jobTypeSlug);
  const engineer = engNames[i % engNames.length];
  const jobId = uuid();
  const scheduledDate = daysAgo(Math.abs(tmpl.daysAgoStart));

  const { error: jobError } = await admin.schema("crm").from("jobs").upsert({
    id: jobId,
    tenant_id: tenantId,
    customer_id: customerId,
    title: tmpl.title,
    description: tmpl.repairDesc,
    scheduled_date: scheduledDate,
    scheduled_time: "09:00",
    status: tmpl.status,
    assigned_engineer: engineer,
    created_by: createdBy,
    is_demo: false,
  }, { onConflict: "id" });

  if (jobError) { log(`   WARN job ${tmpl.title}: ${jobError.message}`); continue; }
  jobsCreated++;

  // Notes
  const noteTexts = [
    `Job booked. Customer briefed on arrival window. ${tmpl.repairDesc}`,
    `On site. ${tmpl.repairDesc} Progress on track.`,
  ];
  if (["completed", "invoiced"].includes(tmpl.status)) {
    noteTexts.push(`Job complete. Customer signed off. Photos taken.`);
  }
  for (const body of noteTexts) {
    await admin.schema("crm").from("notes").insert({
      id: uuid(), tenant_id: tenantId,
      entity_type: "job", entity_id: jobId,
      body, created_by: createdBy, is_demo: false,
    });
    notesCreated++;
  }

  // Expenses (for most jobs)
  if (tmpl.amount > 0 && i % 3 !== 0) {
    const expAmount = Math.round(tmpl.amount * 0.18 * 100) / 100;
    await admin.schema("crm").from("expenses").insert({
      id: uuid(), tenant_id: tenantId,
      job_id: jobId,
      description: "Parts and materials",
      amount: expAmount,
      category: "materials",
      created_by: createdBy, is_demo: false,
    });
    expensesCreated++;
  }

  // Quote
  let quoteId = null;
  if (tmpl.hasQuote && tmpl.amount > 0) {
    quoteId = uuid();
    const qNum = `Q-2026-${String(quoteCounter.n++).padStart(4, "0")}`;
    const lineItems = [
      { description: tmpl.title, qty: 1, unit_price: Math.round(tmpl.amount / 1.2 / (tmpl.vatRate > 0 ? 1 : 1)) },
      ...(i % 4 === 0 ? [{ description: "Call-out fee", qty: 1, unit_price: 50 }] : []),
    ];
    const subtotal = lineItems.reduce((s, l) => s + l.qty * l.unit_price, 0);
    const vatAmount = Math.round(subtotal * tmpl.vatRate * 100) / 100;
    const quoteStatus = ["completed","invoiced"].includes(tmpl.status) ? "accepted" : tmpl.status === "enquiry" ? "draft" : "sent";

    await admin.schema("crm").from("quotes").upsert({
      id: quoteId, tenant_id: tenantId,
      job_id: jobId, customer_id: customerId,
      quote_number: qNum,
      line_items: lineItems,
      subtotal, vat_rate: tmpl.vatRate, total: subtotal + vatAmount,
      status: quoteStatus,
      valid_until: daysFromNow(30),
      created_by: createdBy, is_demo: false,
    }, { onConflict: "id" });
    quotesCreated++;
  }

  // Invoice
  if (tmpl.invStatus && tmpl.amount > 0) {
    const invId = uuid();
    const iNum = `INV-2026-${String(invCounter.n++).padStart(4, "0")}`;
    const lineItems = [{ description: tmpl.title, qty: 1, unit_price: tmpl.amount }];
    const subtotal = tmpl.amount;
    const vatAmount = Math.round(subtotal * tmpl.vatRate * 100) / 100;

    await admin.schema("crm").from("invoices").upsert({
      id: invId, tenant_id: tenantId,
      quote_id: quoteId,
      job_id: jobId, customer_id: customerId,
      invoice_number: iNum,
      line_items: lineItems,
      subtotal, vat_rate: tmpl.vatRate, total: subtotal + vatAmount,
      status: tmpl.invStatus,
      due_date: daysFromNow(14),
      paid_at: tmpl.invStatus === "paid" ? isoAgo(Math.abs(tmpl.daysAgoStart) - 5) : null,
      created_by: createdBy, is_demo: false,
    }, { onConflict: "id" });
    invoicesCreated++;
  }
}

log(`   ${jobsCreated} jobs, ${quotesCreated} quotes, ${invoicesCreated} invoices`);
log(`   ${notesCreated} notes, ${expensesCreated} expense lines`);

// 7. Customer notes
log("\n7. Adding customer notes...");
const customerNoteTexts = [
  "Initial enquiry via website. Needs boiler service + CP12.",
  "Called to confirm visit window. Confirmed 8am–10am slot.",
  "Repeat customer — always pays on time. Prefers bank transfer.",
  "Landlord account. 3 properties to service this year.",
  "New customer — referred by existing client.",
];
for (let i = 0; i < Math.min(customerIds.length, 15); i++) {
  await admin.schema("crm").from("notes").insert({
    id: uuid(), tenant_id: tenantId,
    entity_type: "customer", entity_id: customerIds[i],
    body: customerNoteTexts[i % customerNoteTexts.length],
    created_by: createdBy, is_demo: false,
  });
}
log("   15 customer notes added");

// 8. Summary
log("\n━━━ Seed Complete ━━━\n");
log(`Tenant:   Plumbersrus.ai (slug: ${TENANT_SLUG})`);
log(`Tenant ID: ${tenantId}`);
log(`Owner login: ${OWNER_EMAIL}`);
log(`Password:    ${OWNER_PASSWORD}`);
log(`\nStaff logins (all use same password):`);
for (const eng of ENGINEERS) {
  log(`  ${eng.role.padEnd(12)} ${eng.email}`);
}
log(`\nAll staff password: ${OWNER_PASSWORD}`);
log(`\nOpen http://localhost:3000/login and sign in as any of the above.\n`);
