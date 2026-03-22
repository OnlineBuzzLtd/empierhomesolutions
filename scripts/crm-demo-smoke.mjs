import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const DEMO_SCENARIO_KEY = "core-walkthrough";

const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const tableChecks = [
  ["customers", 1],
  ["leads", 1],
  ["customer_assets", 1],
  ["jobs", 1],
  ["appointments", 1],
  ["quotes", 1],
  ["invoices", 1],
  ["payments", 1],
  ["expenses", 1],
  ["notes", 3],
  ["suppliers", 1],
  ["products", 2],
  ["quote_templates", 1],
  ["user_profiles", 2],
  ["user_certifications", 2],
  ["attachments", 4],
];

let failed = false;

for (const [table, minimum] of tableChecks) {
  const { count, error } = await admin
    .schema("crm")
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("is_demo", true)
    .eq("demo_scenario_key", DEMO_SCENARIO_KEY);

  if (error) {
    failed = true;
    console.error(`FAIL crm.${table} query failed: ${error.message}`);
    continue;
  }

  if ((count ?? 0) < minimum) {
    failed = true;
    console.error(`FAIL crm.${table} expected at least ${minimum} demo rows, found ${count ?? 0}`);
    continue;
  }

  console.log(`PASS crm.${table} has ${count ?? 0} demo rows`);
}

const { data: files, error: fileError } = await admin.storage.from("crm-uploads").list("demo/core-walkthrough", {
  limit: 50,
  sortBy: { column: "name", order: "asc" },
});

if (fileError) {
  failed = true;
  console.error(`FAIL demo storage query failed: ${fileError.message}`);
} else if (!files || files.length === 0) {
  failed = true;
  console.error("FAIL no demo storage objects found under crm-uploads/demo/core-walkthrough");
} else {
  console.log(`PASS demo storage contains ${files.length} top-level objects/folders`);
}

if (failed) {
  process.exit(1);
}
