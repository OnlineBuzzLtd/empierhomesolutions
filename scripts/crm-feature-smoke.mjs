import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const { baseUrl, supabaseUrl, publishableKey, serviceRoleKey } = requireCrmScriptConfig(true);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const createdTenantIds = [];
const createdUserIds = [];

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logFail(message) {
  console.error(`FAIL ${message}`);
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function signUpWorkspace(label) {
  const suffix = randomUUID().slice(0, 8);
  const email = `crm-feature-${label}-${suffix}@example.com`;
  const password = `Feature-${suffix}-A1!`;
  const businessName = `Feature ${label} Heating ${suffix}`;
  const slug = `feature-${label}-${suffix}`.toLowerCase();

  const response = await fetch(`${baseUrl}/api/crm/onboarding/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: businessName,
      slug,
      full_name: `Owner ${label}`,
      email,
      password,
      primary_phone: "07000000000",
      support_email: email,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.tenant?.id) {
    throw new Error(body?.error ?? `Failed to sign up workspace ${label}`);
  }

  createdTenantIds.push(body.tenant.id);
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`Could not resolve created owner user for ${email}`);
  }
  createdUserIds.push(user.id);

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    throw new Error(signIn.error.message);
  }

  return {
    tenantId: body.tenant.id,
    email,
    password,
    userId: user.id,
    client,
  };
}

async function createTenantUser(tenantId, role, label) {
  const suffix = randomUUID().slice(0, 8);
  const email = `crm-feature-${label}-${role}-${suffix}@example.com`;
  const password = `Feature-${suffix}-A1!`;
  const fullName = `${label} ${role}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create ${role} user`);
  }

  createdUserIds.push(data.user.id);

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    admin
      .schema("crm")
      .from("tenant_memberships")
      .insert({
        tenant_id: tenantId,
        user_id: data.user.id,
        role,
        active: true,
        is_owner: false,
        is_demo: false,
      })
      .select("*")
      .single(),
    admin
      .schema("crm")
      .from("user_profiles")
      .insert({
        tenant_id: tenantId,
        user_id: data.user.id,
        role,
        full_name: fullName,
        email,
        active: true,
        is_demo: false,
      })
      .select("*")
      .single(),
  ]);

  if (membershipError || !membership) {
    throw new Error(membershipError?.message ?? "Failed to create tenant membership");
  }

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Failed to create user profile");
  }

  return { user: data.user, membership, profile };
}

async function cleanup() {
  for (const tenantId of createdTenantIds.reverse()) {
    await admin.schema("crm").from("tenants").delete().eq("id", tenantId);
  }

  for (const userId of createdUserIds.reverse()) {
    await admin.auth.admin.deleteUser(userId);
  }
}

let failed = false;

try {
  const ownerA = await signUpWorkspace("alpha");
  const ownerB = await signUpWorkspace("beta");
  logPass("public signup creates isolated workspaces");

  const nextQuoteA = await ownerA.client.schema("crm").rpc("next_sequence", { p_sequence_key: "quote", p_tenant_id: ownerA.tenantId });
  const nextQuoteB = await ownerB.client.schema("crm").rpc("next_sequence", { p_sequence_key: "quote", p_tenant_id: ownerB.tenantId });
  expect(nextQuoteA.error === null && Number(nextQuoteA.data) > 0, nextQuoteA.error?.message ?? "Tenant A quote sequence failed");
  expect(nextQuoteB.error === null && Number(nextQuoteB.data) > 0, nextQuoteB.error?.message ?? "Tenant B quote sequence failed");
  expect(Number(nextQuoteA.data) === Number(nextQuoteB.data), "Quote sequences are not isolated per tenant");
  logPass("tenant-scoped quote numbering is isolated");

  const engineer = await createTenantUser(ownerA.tenantId, "engineer", "alpha");
  logPass("tenant membership provisioning works for additional staff");

  const { data: supplier, error: supplierError } = await ownerA.client
    .schema("crm")
    .from("suppliers")
    .insert({
      name: "Feature Smoke Supplier",
      category: "materials",
      email: "supplier@example.com",
    })
    .select("*")
    .single();
  expect(!supplierError && supplier?.id, supplierError?.message ?? "Could not create supplier");

  const { data: customer, error: customerError } = await ownerA.client
    .schema("crm")
    .from("customers")
    .insert({
      full_name: "Feature Smoke Customer",
      phone: "07123456789",
      email: "customer@example.com",
      archived: false,
    })
    .select("*")
    .single();
  expect(!customerError && customer?.id, customerError?.message ?? "Could not create customer");

  const { data: site, error: siteError } = await ownerA.client
    .schema("crm")
    .from("sites")
    .insert({
      customer_id: customer.id,
      label: "Install Address",
      address_line1: "10 Testing Lane",
      city: "London",
      postcode: "W1A 1AA",
      access_notes: "Rear gate access",
      parking_notes: "Visitor permit required",
      is_primary: true,
    })
    .select("*")
    .single();
  expect(!siteError && site?.id, siteError?.message ?? "Could not create site");

  const { data: siteContact, error: siteContactError } = await ownerA.client
    .schema("crm")
    .from("site_contacts")
    .insert({
      site_id: site.id,
      full_name: "Site Contact",
      phone: "07000000001",
      email: "site-contact@example.com",
      role_label: "Tenant",
      is_primary: true,
    })
    .select("*")
    .single();
  expect(!siteContactError && siteContact?.id, siteContactError?.message ?? "Could not create site contact");
  logPass("sites and site contacts can be created");

  const { data: job, error: jobError } = await ownerA.client
    .schema("crm")
    .from("jobs")
    .insert({
      customer_id: customer.id,
      site_id: site.id,
      site_contact_id: siteContact.id,
      title: "Feature Smoke Boiler Install",
      status: "booked",
      assigned_engineer: engineer.profile.full_name,
    })
    .select("*")
    .single();
  expect(!jobError && job?.id, jobError?.message ?? "Could not create job");

  const { data: assignee, error: assigneeError } = await ownerA.client
    .schema("crm")
    .from("job_assignees")
    .insert({
      job_id: job.id,
      user_profile_id: engineer.profile.id,
      assignment_role: "Lead engineer",
    })
    .select("*")
    .single();
  expect(!assigneeError && assignee?.id, assigneeError?.message ?? "Could not assign engineer to job");
  logPass("jobs support structured sites and multi-assignee delivery");

  const { data: phase, error: phaseError } = await ownerA.client
    .schema("crm")
    .from("job_phases")
    .insert({
      job_id: job.id,
      name: "First fix",
      sort_order: 1,
      status: "planned",
    })
    .select("*")
    .single();
  expect(!phaseError && phase?.id, phaseError?.message ?? "Could not create job phase");

  const { data: variation, error: variationError } = await ownerA.client
    .schema("crm")
    .from("job_variations")
    .insert({
      job_id: job.id,
      title: "Upgrade flue",
      description: "Customer requested flue upgrade",
      estimated_value: 180,
      status: "draft",
      created_by: engineer.user.id,
    })
    .select("*")
    .single();
  expect(!variationError && variation?.id, variationError?.message ?? "Could not create job variation");
  logPass("job phases and variations work");

  const quoteSequence = await ownerA.client.schema("crm").rpc("next_sequence", { p_sequence_key: "quote", p_tenant_id: ownerA.tenantId });
  expect(quoteSequence.error === null, quoteSequence.error?.message ?? "Could not allocate quote sequence");
  const quoteNumber = `Q-${new Date().getUTCFullYear()}-${String(Number(quoteSequence.data)).padStart(4, "0")}`;
  const lineItems = [{ description: "Boiler install", qty: 1, unit_price: 2400 }];
  const { data: quote, error: quoteError } = await ownerA.client
    .schema("crm")
    .from("quotes")
    .insert({
      job_id: job.id,
      customer_id: customer.id,
      quote_number: quoteNumber,
      document_type: "estimate",
      current_version_number: 2,
      line_items: lineItems,
      subtotal: 2400,
      vat_rate: 0.2,
      vat_category: "standard_20",
      total: 2880,
      status: "accepted",
    })
    .select("*")
    .single();
  expect(!quoteError && quote?.id, quoteError?.message ?? "Could not create quote");

  const [{ data: versionOne, error: versionOneError }, { data: versionTwo, error: versionTwoError }] = await Promise.all([
    ownerA.client
      .schema("crm")
      .from("quote_versions")
      .insert({
        quote_id: quote.id,
        version_number: 1,
        document_type: "estimate",
        line_items: lineItems,
        subtotal: 2400,
        vat_rate: 0.2,
        vat_category: "standard_20",
        total: 2880,
        status: "draft",
        change_summary: "Initial estimate",
        created_by: ownerA.userId,
      })
      .select("*")
      .single(),
    ownerA.client
      .schema("crm")
      .from("quote_versions")
      .insert({
        quote_id: quote.id,
        version_number: 2,
        document_type: "quote",
        line_items: lineItems,
        subtotal: 2400,
        vat_rate: 0.2,
        vat_category: "standard_20",
        total: 2880,
        status: "accepted",
        change_summary: "Converted to quote",
        created_by: ownerA.userId,
      })
      .select("*")
      .single(),
  ]);
  expect(!versionOneError && versionOne?.id, versionOneError?.message ?? "Could not create first quote version");
  expect(!versionTwoError && versionTwo?.id, versionTwoError?.message ?? "Could not create second quote version");

  const { data: acceptance, error: acceptanceError } = await ownerA.client
    .schema("crm")
    .from("quote_acceptances")
    .insert({
      quote_id: quote.id,
      accepted_by_name: "Feature Customer",
      accepted_by_email: "customer@example.com",
      acceptance_method: "email",
      notes: "Approved during smoke test",
    })
    .select("*")
    .single();
  expect(!acceptanceError && acceptance?.id, acceptanceError?.message ?? "Could not record quote acceptance");

  const { data: invoiceSchedule, error: invoiceScheduleError } = await ownerA.client
    .schema("crm")
    .from("invoice_schedules")
    .insert({
      quote_id: quote.id,
      label: "Deposit",
      payment_type: "deposit",
      percentage: 25,
      due_offset_days: 7,
      status: "planned",
    })
    .select("*")
    .single();
  expect(!invoiceScheduleError && invoiceSchedule?.id, invoiceScheduleError?.message ?? "Could not create invoice schedule");
  logPass("quotes support versions, acceptance, and staged invoice schedules");

  const invoiceSequence = await ownerA.client.schema("crm").rpc("next_sequence", { p_sequence_key: "invoice", p_tenant_id: ownerA.tenantId });
  expect(invoiceSequence.error === null, invoiceSequence.error?.message ?? "Could not allocate invoice sequence");
  const invoiceNumber = `INV-${new Date().getUTCFullYear()}-${String(Number(invoiceSequence.data)).padStart(4, "0")}`;
  const { data: invoice, error: invoiceError } = await ownerA.client
    .schema("crm")
    .from("invoices")
    .insert({
      quote_id: quote.id,
      job_id: job.id,
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      line_items: [{ description: "Deposit invoice", qty: 1, unit_price: 600 }],
      subtotal: 600,
      vat_rate: 0.2,
      vat_category: "standard_20",
      total: 720,
      status: "paid",
    })
    .select("*")
    .single();
  expect(!invoiceError && invoice?.id, invoiceError?.message ?? "Could not create invoice");

  const { error: scheduleUpdateError } = await ownerA.client
    .schema("crm")
    .from("invoice_schedules")
    .update({
      invoice_id: invoice.id,
      status: "paid",
    })
    .eq("id", invoiceSchedule.id);
  expect(!scheduleUpdateError, scheduleUpdateError?.message ?? "Could not update invoice schedule");

  const { data: payment, error: paymentError } = await ownerA.client
    .schema("crm")
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      quote_id: quote.id,
      customer_id: customer.id,
      payment_type: "deposit",
      amount: 720,
      status: "received",
      reference: "feature-smoke-payment",
    })
    .select("*")
    .single();
  expect(!paymentError && payment?.id, paymentError?.message ?? "Could not create payment");
  logPass("staged invoicing and payment tracking work");

  const [{ data: hazard, error: hazardError }, { data: checklist, error: checklistError }, { data: certificate, error: certificateError }] = await Promise.all([
    ownerA.client
      .schema("crm")
      .from("job_hazards")
      .insert({ job_id: job.id, title: "Asbestos risk", status: "active" })
      .select("*")
      .single(),
    ownerA.client
      .schema("crm")
      .from("job_checklists")
      .insert({ job_id: job.id, title: "Commissioning checklist", status: "required" })
      .select("*")
      .single(),
    ownerA.client
      .schema("crm")
      .from("job_certificates")
      .insert({ job_id: job.id, title: "Benchmark certificate", certificate_number: "CERT-001", status: "draft" })
      .select("*")
      .single(),
  ]);
  expect(!hazardError && hazard?.id, hazardError?.message ?? "Could not create hazard");
  expect(!checklistError && checklist?.id, checklistError?.message ?? "Could not create checklist");
  expect(!certificateError && certificate?.id, certificateError?.message ?? "Could not create certificate");
  logPass("hazards, checklists, and certificates work");

  const { data: purchaseOrder, error: poError } = await ownerA.client
    .schema("crm")
    .from("purchase_orders")
    .insert({
      job_id: job.id,
      supplier_id: supplier.id,
      po_number: "PO-FEATURE-001",
      status: "issued",
      total_amount: 320,
    })
    .select("*")
    .single();
  expect(!poError && purchaseOrder?.id, poError?.message ?? "Could not create purchase order");

  const { data: reconciliation, error: reconciliationError } = await ownerA.client
    .schema("crm")
    .from("supplier_reconciliation")
    .insert({
      job_id: job.id,
      purchase_order_id: purchaseOrder.id,
      supplier_id: supplier.id,
      entry_type: "invoice",
      reference_number: "SUP-INV-001",
      amount: 320,
      status: "reconciled",
    })
    .select("*")
    .single();
  expect(!reconciliationError && reconciliation?.id, reconciliationError?.message ?? "Could not create supplier reconciliation");
  logPass("purchase orders and supplier reconciliation work");

  const { data: hiddenCustomer, error: hiddenCustomerError } = await ownerB.client
    .schema("crm")
    .from("customers")
    .select("id")
    .eq("id", customer.id)
    .maybeSingle();
  expect(!hiddenCustomerError && hiddenCustomer === null, hiddenCustomerError?.message ?? "Cross-tenant read was not blocked");
  logPass("tenant isolation blocks cross-workspace customer access");
} catch (error) {
  failed = true;
  logFail(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

if (failed) {
  process.exit(1);
}
