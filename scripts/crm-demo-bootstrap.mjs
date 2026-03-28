import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const DEMO_SCENARIO_KEY = "core-walkthrough";
const DEMO_PASSWORD = process.env.CRM_DEMO_USER_PASSWORD ?? "Replace-Me-In-Production-2026!";
const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const DEMO_IDS = {
  lead: "11111111-1111-4111-8111-111111111112",
  appointment: "11111111-1111-4111-8111-111111111118",
  supplier: "11111111-1111-4111-8111-111111111123",
  managerCertification: "11111111-1111-4111-8111-111111111127",
  engineerCertification: "11111111-1111-4111-8111-111111111128",
  customerAttachment: "11111111-1111-4111-8111-111111111129",
  jobAttachment: "11111111-1111-4111-8111-111111111130",
  quoteAttachment: "11111111-1111-4111-8111-111111111131",
  invoiceAttachment: "11111111-1111-4111-8111-111111111132",
};

const DEMO_USERS = [
  {
    email: "crm-demo-manager@empirehomesolutions.local",
    password: DEMO_PASSWORD,
    fullName: "Demo Manager",
    role: "management",
    agreedHours: "Mon-Fri 08:00-17:00",
    payType: "salary",
    payNotes: "Oversees sales walkthroughs and commercial approvals.",
    emergencyContact: "Ops Desk",
    contractFileUrl: "demo/core-walkthrough/staff/demo-manager-contract.txt",
    certification: {
      id: DEMO_IDS.managerCertification,
      title: "Internal demo sign-off",
      category: "training",
      issuer: "Operations",
      issue_date: "2026-03-20",
      expiry_date: "2027-03-20",
      reminder_days_before: 30,
      file_url: "demo/core-walkthrough/staff/demo-manager-contract.txt",
      notes: "Used to demonstrate certification expiry tracking for management staff.",
    },
  },
  {
    email: "crm-demo-engineer@empirehomesolutions.local",
    password: DEMO_PASSWORD,
    fullName: "Demo Engineer",
    role: "engineer",
    agreedHours: "Tue-Sat 08:30-17:30",
    payType: "day-rate",
    payNotes: "Assigned to the walkthrough install job and recurring survey appointment.",
    emergencyContact: "Workshop Lead",
    contractFileUrl: "demo/core-walkthrough/staff/demo-engineer-contract.txt",
    certification: {
      id: DEMO_IDS.engineerCertification,
      title: "Gas Safe Registration",
      category: "compliance",
      issuer: "Gas Safe Register",
      issue_date: "2026-01-15",
      expiry_date: "2027-01-15",
      reminder_days_before: 45,
      file_url: "demo/core-walkthrough/staff/demo-engineer-gassafe.pdf",
      notes: "Demo compliance record used in staff and reminder walkthroughs.",
    },
  },
];

const DEMO_ATTACHMENTS = [
  {
    id: DEMO_IDS.customerAttachment,
    entity_type: "customer",
    entity_id: "11111111-1111-4111-8111-111111111111",
    file_name: "demo-home-photo.svg",
    file_url: "demo/core-walkthrough/customers/demo-home-photo.svg",
    file_type: "photo",
    contentType: "image/svg+xml",
    body: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#e2e8f0"/><rect x="180" y="280" width="840" height="360" fill="#cbd5e1"/><polygon points="150,320 600,120 1050,320" fill="#94a3b8"/><rect x="320" y="420" width="180" height="220" fill="#0f172a"/><rect x="620" y="420" width="220" height="140" fill="#ffffff"/><text x="600" y="720" text-anchor="middle" font-family="Arial" font-size="44" fill="#0f172a">CRM Demo Property Photo</text></svg>',
      "utf8",
    ),
  },
  {
    id: DEMO_IDS.jobAttachment,
    entity_type: "job",
    entity_id: "11111111-1111-4111-8111-111111111114",
    file_name: "demo-gas-safe-certificate.pdf",
    file_url: "demo/core-walkthrough/jobs/demo-gas-safe-certificate.pdf",
    file_type: "certificate",
    contentType: "application/pdf",
    body: Buffer.from("%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 85>>stream\nBT /F1 18 Tf 40 120 Td (CRM Demo Gas Safe Certificate) Tj 0 -28 Td (Training document for signed-url attachment demo.) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000116 00000 n \n0000000242 00000 n \n0000000379 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n449\n%%EOF", "utf8"),
  },
  {
    id: DEMO_IDS.quoteAttachment,
    entity_type: "quote",
    entity_id: "11111111-1111-4111-8111-111111111119",
    file_name: "demo-quote-summary.pdf",
    file_url: "demo/core-walkthrough/quotes/demo-quote-summary.pdf",
    file_type: "quote",
    contentType: "application/pdf",
    body: Buffer.from("%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 220]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 80>>stream\nBT /F1 18 Tf 40 140 Td (CRM Demo Quote Pack) Tj 0 -28 Td (Used to demonstrate commercial attachments and signed downloads.) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000116 00000 n \n0000000243 00000 n \n0000000376 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n446\n%%EOF", "utf8"),
  },
  {
    id: DEMO_IDS.invoiceAttachment,
    entity_type: "invoice",
    entity_id: "11111111-1111-4111-8111-111111111120",
    file_name: "demo-invoice-supporting-doc.pdf",
    file_url: "demo/core-walkthrough/invoices/demo-invoice-supporting-doc.pdf",
    file_type: "invoice",
    contentType: "application/pdf",
    body: Buffer.from("%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 220]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 83>>stream\nBT /F1 18 Tf 40 140 Td (CRM Demo Invoice Support Pack) Tj 0 -28 Td (Used to demonstrate commercial docs inside invoice detail.) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000116 00000 n \n0000000243 00000 n \n0000000379 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n449\n%%EOF", "utf8"),
  },
];

const STAFF_FILES = [
  {
    path: "demo/core-walkthrough/staff/demo-manager-contract.txt",
    contentType: "text/plain",
    body: Buffer.from("CRM demo manager contract placeholder. Internal training use only.\n", "utf8"),
  },
  {
    path: "demo/core-walkthrough/staff/demo-engineer-contract.txt",
    contentType: "text/plain",
    body: Buffer.from("CRM demo engineer contract placeholder. Internal training use only.\n", "utf8"),
  },
  {
    path: "demo/core-walkthrough/staff/demo-engineer-gassafe.pdf",
    contentType: "application/pdf",
    body: Buffer.from("%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 220]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 82>>stream\nBT /F1 18 Tf 40 140 Td (CRM Demo Gas Safe Registration) Tj 0 -28 Td (Placeholder certification asset for demo staff.) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000116 00000 n \n0000000243 00000 n \n0000000378 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n448\n%%EOF", "utf8"),
  },
];

const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function log(message) {
  console.log(message);
}

async function findUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      return match;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function waitForProfile(userId) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await admin.schema("crm").from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (data) {
      return data;
    }
    if (error && attempt === 11) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for crm.user_profiles row for ${userId}`);
}

async function ensureDemoUser(userConfig) {
  let user = await findUserByEmail(userConfig.email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: userConfig.email,
      password: userConfig.password,
      email_confirm: true,
      user_metadata: { full_name: userConfig.fullName },
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? `Failed to create demo user ${userConfig.email}`);
    }
    user = data.user;
    log(`PASS created auth user ${userConfig.email}`);
  } else {
    await admin.auth.admin.updateUserById(user.id, {
      password: userConfig.password,
      email_confirm: true,
      user_metadata: { full_name: userConfig.fullName },
    });
    log(`PASS reused auth user ${userConfig.email}`);
  }

  const profile = await waitForProfile(user.id);
  const { error: profileError } = await admin
    .schema("crm")
    .from("user_profiles")
    .update({
      role: userConfig.role,
      full_name: userConfig.fullName,
      email: userConfig.email,
      emergency_contact: userConfig.emergencyContact,
      agreed_hours: userConfig.agreedHours,
      pay_type: userConfig.payType,
      pay_notes: userConfig.payNotes,
      contract_file_url: userConfig.contractFileUrl,
      active: true,
      is_demo: true,
      demo_scenario_key: DEMO_SCENARIO_KEY,
    })
    .eq("id", profile.id);
  if (profileError) {
    throw new Error(profileError.message);
  }

  const certificationPayload = {
    ...userConfig.certification,
    tenant_id: profile.tenant_id,
    user_profile_id: profile.id,
    is_demo: true,
    demo_scenario_key: DEMO_SCENARIO_KEY,
  };
  const { error: certificationError } = await admin
    .schema("crm")
    .from("user_certifications")
    .upsert(certificationPayload, { onConflict: "id" });
  if (certificationError) {
    throw new Error(certificationError.message);
  }

  return { user, profile };
}

async function uploadDemoFiles() {
  const objects = [...STAFF_FILES, ...DEMO_ATTACHMENTS.map(({ file_url, contentType, body }) => ({ path: file_url, contentType, body }))];

  for (const object of objects) {
    const { error } = await admin.storage.from("crm-uploads").upload(object.path, object.body, {
      upsert: true,
      contentType: object.contentType,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  log(`PASS uploaded ${objects.length} demo storage objects`);
}

async function upsertAttachmentRows(managerUserId) {
  const rows = DEMO_ATTACHMENTS.map(({ id, entity_type, entity_id, file_name, file_url, file_type }) => ({
    id,
    tenant_id: DEMO_TENANT_ID,
    entity_type,
    entity_id,
    file_name,
    file_url,
    file_type,
    created_by: managerUserId,
    is_demo: true,
    demo_scenario_key: DEMO_SCENARIO_KEY,
  }));

  const { error } = await admin.schema("crm").from("attachments").upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }

  log(`PASS upserted ${rows.length} attachment rows`);
}

async function wireAssignments(managerUserId, engineerUserId) {
  const leadUpdate = await admin
    .schema("crm")
    .from("leads")
    .update({ assigned_to: managerUserId })
    .eq("id", DEMO_IDS.lead)
    .eq("is_demo", true)
    .eq("demo_scenario_key", DEMO_SCENARIO_KEY);
  if (leadUpdate.error) {
    throw new Error(leadUpdate.error.message);
  }

  const appointmentUpdate = await admin
    .schema("crm")
    .from("appointments")
    .update({ assigned_to: engineerUserId })
    .eq("id", DEMO_IDS.appointment)
    .eq("is_demo", true)
    .eq("demo_scenario_key", DEMO_SCENARIO_KEY);
  if (appointmentUpdate.error) {
    throw new Error(appointmentUpdate.error.message);
  }

  const jobUpdate = await admin
    .schema("crm")
    .from("jobs")
    .update({ created_by: managerUserId, assigned_engineer: "Demo Engineer" })
    .eq("id", "11111111-1111-4111-8111-111111111114")
    .eq("is_demo", true)
    .eq("demo_scenario_key", DEMO_SCENARIO_KEY);
  if (jobUpdate.error) {
    throw new Error(jobUpdate.error.message);
  }

  log("PASS wired demo ownership onto lead, appointment, and job records");
}

async function validateDemoDataset() {
  const expectations = [
    { table: "customers", minimum: 1 },
    { table: "leads", minimum: 1 },
    { table: "customer_assets", minimum: 1 },
    { table: "jobs", minimum: 1 },
    { table: "appointments", minimum: 1 },
    { table: "quotes", minimum: 1 },
    { table: "invoices", minimum: 1 },
    { table: "payments", minimum: 1 },
    { table: "expenses", minimum: 1 },
    { table: "notes", minimum: 3 },
    { table: "suppliers", minimum: 1 },
    { table: "products", minimum: 2 },
    { table: "quote_templates", minimum: 1 },
    { table: "user_profiles", minimum: 2 },
    { table: "user_certifications", minimum: 2 },
    { table: "attachments", minimum: 4 },
  ];

  for (const expectation of expectations) {
    const { count, error } = await admin
      .schema("crm")
      .from(expectation.table)
      .select("*", { count: "exact", head: true })
      .eq("is_demo", true)
      .eq("demo_scenario_key", DEMO_SCENARIO_KEY);
    if (error) {
      throw new Error(error.message);
    }
    if ((count ?? 0) < expectation.minimum) {
      throw new Error(`Expected at least ${expectation.minimum} demo rows in crm.${expectation.table}, found ${count ?? 0}`);
    }
  }

  const { data: storageObjects, error: storageError } = await admin.storage.from("crm-uploads").list("demo/core-walkthrough", {
    limit: 50,
    sortBy: { column: "name", order: "asc" },
  });
  if (storageError) {
    throw new Error(storageError.message);
  }
  if (!storageObjects || storageObjects.length === 0) {
    throw new Error("No demo storage objects found under crm-uploads/demo/core-walkthrough");
  }

  log("PASS demo dataset validation succeeded");
}

try {
  const manager = await ensureDemoUser(DEMO_USERS[0]);
  const engineer = await ensureDemoUser(DEMO_USERS[1]);
  await uploadDemoFiles();
  await upsertAttachmentRows(manager.user.id);
  await wireAssignments(manager.user.id, engineer.user.id);
  await validateDemoDataset();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
