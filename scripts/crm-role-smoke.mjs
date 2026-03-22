import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const { supabaseUrl, publishableKey, serviceRoleKey } = requireCrmScriptConfig(true);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const createdUserIds = [];
const createdServiceIds = [];
const createdCustomerIds = [];
const createdTemplateIds = [];

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logFail(message) {
  console.error(`FAIL ${message}`);
}

async function waitForProfile(userId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await admin.schema("crm").from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (data) {
      return data;
    }
    if (error && attempt === 9) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for crm.user_profiles row for ${userId}`);
}

async function createSignedInUser(role) {
  const suffix = randomUUID().slice(0, 8);
  const email = `crm-smoke-${role}-${suffix}@example.com`;
  const password = `Smoke-${suffix}-A1!`;
  const fullName = `CRM Smoke ${role}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create ${role} smoke user`);
  }

  createdUserIds.push(data.user.id);
  const profile = await waitForProfile(data.user.id);
  const { error: profileError } = await admin
    .schema("crm")
    .from("user_profiles")
    .update({ role, full_name: fullName, active: true })
    .eq("id", profile.id);
  if (profileError) {
    throw new Error(profileError.message);
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const signInResult = await client.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    throw new Error(signInResult.error.message);
  }

  return { client, email, password, userId: data.user.id };
}

async function cleanup() {
  for (const templateId of createdTemplateIds) {
    await admin.schema("crm").from("quote_templates").delete().eq("id", templateId);
  }
  for (const customerId of createdCustomerIds) {
    await admin.schema("crm").from("customers").delete().eq("id", customerId);
  }
  for (const serviceId of createdServiceIds) {
    await admin.schema("crm").from("services").delete().eq("id", serviceId);
  }
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

let failed = false;

try {
  const manager = await createSignedInUser("management");
  const sales = await createSignedInUser("sales");

  const slug = `crm-smoke-${Date.now()}`;
  const { data: service, error: serviceError } = await manager.client
    .schema("crm")
    .from("services")
    .insert({ slug, name: "CRM Smoke Service", active: true })
    .select("*")
    .single();
  if (serviceError || !service) {
    throw new Error(serviceError?.message ?? "Manager could not create service");
  }
  createdServiceIds.push(service.id);
  logPass("management can create services");

  const salesServiceAttempt = await sales.client
    .schema("crm")
    .from("services")
    .insert({ slug: `${slug}-sales`, name: "Blocked Service", active: true })
    .select("*")
    .single();
  if (!salesServiceAttempt.error) {
    failed = true;
    logFail("sales unexpectedly created a service");
  } else {
    logPass("sales cannot create services");
  }

  const { data: customer, error: customerError } = await sales.client
    .schema("crm")
    .from("customers")
    .insert({ full_name: "CRM Smoke Customer", phone: "07000000000", archived: false })
    .select("*")
    .single();
  if (customerError || !customer) {
    throw new Error(customerError?.message ?? "Sales could not create customer");
  }
  createdCustomerIds.push(customer.id);
  logPass("sales can create customers");

  const { error: customerUpdateError } = await sales.client
    .schema("crm")
    .from("customers")
    .update({ notes: "updated by sales smoke test" })
    .eq("id", customer.id)
    .select("*")
    .single();
  if (customerUpdateError) {
    throw new Error(customerUpdateError.message);
  }
  logPass("sales can update customers");

  const salesDeleteAttempt = await sales.client.schema("crm").from("customers").delete().eq("id", customer.id).select("*");
  const { data: customerAfterDelete } = await admin.schema("crm").from("customers").select("id").eq("id", customer.id).maybeSingle();
  if (!salesDeleteAttempt.error && !salesDeleteAttempt.data?.length && customerAfterDelete) {
    logPass("sales cannot delete customers");
  } else if (!salesDeleteAttempt.error) {
    failed = true;
    logFail("sales unexpectedly deleted a customer");
  } else {
    logPass("sales cannot delete customers");
  }

  const { data: template, error: templateError } = await manager.client
    .schema("crm")
    .from("quote_templates")
    .insert({
      name: "CRM Smoke Template",
      service_id: service.id,
      line_items: [{ description: "Smoke line item", qty: 1, unit_price: 100 }],
      optional_extras: [{ description: "Optional extra", qty: 1, unit_price: 25 }],
      payment_terms: { deposit: "25% on booking" },
      active: true,
    })
    .select("*")
    .single();
  if (templateError || !template) {
    throw new Error(templateError?.message ?? "Manager could not create quote template");
  }
  createdTemplateIds.push(template.id);
  logPass("management can create quote templates");

  const salesTemplateAttempt = await sales.client
    .schema("crm")
    .from("quote_templates")
    .insert({
      name: "Blocked Template",
      line_items: [{ description: "Blocked", qty: 1, unit_price: 50 }],
      optional_extras: [],
      active: true,
    })
    .select("*")
    .single();
  if (!salesTemplateAttempt.error) {
    failed = true;
    logFail("sales unexpectedly created a quote template");
  } else {
    logPass("sales cannot create quote templates");
  }
} catch (error) {
  failed = true;
  logFail(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

if (failed) {
  process.exit(1);
}
