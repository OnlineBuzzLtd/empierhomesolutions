/**
 * One-off operator script for the Empire Home Solutions tenant.
 *
 * Ensures Shane has an additional short engineer login:
 *   Shane <shane@ehs.local>
 *
 * The legacy shane@empirehomesolutions.local login is left untouched.
 *
 * Run:
 *   node scripts/empire-shane-short-login.mjs          # dry-run preview
 *   EHS_SHANE_SHORT_LOGIN_PASSWORD="..." node scripts/empire-shane-short-login.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_LABEL = "Empire Home Solutions";
const LEGACY_EMAIL = "shane@empirehomesolutions.local";

const SHANE_SHORT_LOGIN = {
  fullName: "Shane",
  email: "shane@ehs.local",
  phone: "07740 017130",
  role: "engineer",
};

const apply = process.argv.includes("--apply");
const shortLoginPassword = process.env.EHS_SHANE_SHORT_LOGIN_PASSWORD ?? "";

function log(...args) {
  console.log(...args);
}

async function findProfileByEmail(admin, email) {
  const { data, error } = await admin
    .schema("crm")
    .from("user_profiles")
    .select("id, user_id, full_name, role, active, email")
    .eq("tenant_id", TENANT_ID)
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findAuthUserByEmail(admin, email) {
  const target = email.toLowerCase();
  let page = 1;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);

    const user = data.users.find((entry) => entry.email?.toLowerCase() === target);
    if (user) return user;
    if (data.users.length < 1000) return null;
    page += 1;
  }

  throw new Error("Could not confirm auth user uniqueness after 50,000 users.");
}

async function updateAuthLogin(admin, userId) {
  assertPasswordConfigured();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: SHANE_SHORT_LOGIN.email,
    password: shortLoginPassword,
    email_confirm: true,
    user_metadata: {
      full_name: SHANE_SHORT_LOGIN.fullName,
      crm_tenant_id: TENANT_ID,
      crm_role: SHANE_SHORT_LOGIN.role,
    },
  });
  if (error) throw new Error(`updateUserById failed: ${error.message}`);
}

async function upsertEngineerRows(admin, userId) {
  const { error: profileError } = await admin.schema("crm").from("user_profiles").upsert(
    {
      tenant_id: TENANT_ID,
      user_id: userId,
      role: SHANE_SHORT_LOGIN.role,
      full_name: SHANE_SHORT_LOGIN.fullName,
      phone: SHANE_SHORT_LOGIN.phone,
      email: SHANE_SHORT_LOGIN.email.toLowerCase(),
      active: true,
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (profileError) throw profileError;

  const { error: membershipError } = await admin.schema("crm").from("tenant_memberships").upsert(
    {
      tenant_id: TENANT_ID,
      user_id: userId,
      role: SHANE_SHORT_LOGIN.role,
      active: true,
      is_owner: false,
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (membershipError) throw membershipError;
}

async function createShortLogin(admin) {
  assertPasswordConfigured();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: SHANE_SHORT_LOGIN.email,
    password: shortLoginPassword,
    email_confirm: true,
    user_metadata: {
      full_name: SHANE_SHORT_LOGIN.fullName,
      crm_tenant_id: TENANT_ID,
      crm_role: SHANE_SHORT_LOGIN.role,
    },
  });
  if (error || !created.user) {
    throw new Error(`createUser failed: ${error?.message ?? "unknown"}`);
  }

  try {
    await upsertEngineerRows(admin, created.user.id);
  } catch (upsertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw upsertError;
  }

  return created.user.id;
}

function assertPasswordConfigured() {
  if (!shortLoginPassword) {
    throw new Error("Set EHS_SHANE_SHORT_LOGIN_PASSWORD before applying the login change.");
  }
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);

  log("empire-shane-short-login.mjs");
  log(`  mode:     ${apply ? "APPLY (will write)" : "DRY RUN (no changes will be written)"}`);
  log(`  Supabase: ${supabaseUrl}`);
  log(`  Tenant:   ${TENANT_LABEL} (${TENANT_ID})`);
  log("");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const legacyProfile = await findProfileByEmail(admin, LEGACY_EMAIL);
  if (legacyProfile) {
    log(`Legacy login preserved: ${LEGACY_EMAIL} (user_id=${legacyProfile.user_id})`);
  } else {
    log(`Legacy login not found in crm.user_profiles: ${LEGACY_EMAIL}`);
  }

  const existingProfile = await findProfileByEmail(admin, SHANE_SHORT_LOGIN.email);
  if (existingProfile) {
    log(`Short login already exists: ${SHANE_SHORT_LOGIN.email} (user_id=${existingProfile.user_id})`);
    if (!apply) {
      log("  [dry-run] would reset password from EHS_SHANE_SHORT_LOGIN_PASSWORD");
      log(`  [dry-run] would ensure active engineer profile and tenant membership`);
      return;
    }

    await updateAuthLogin(admin, existingProfile.user_id);
    await upsertEngineerRows(admin, existingProfile.user_id);
    log("Updated existing short login.");
    return;
  }

  const existingAuthUser = await findAuthUserByEmail(admin, SHANE_SHORT_LOGIN.email);
  if (existingAuthUser) {
    log(
      `Short auth user exists without matching profile: ${SHANE_SHORT_LOGIN.email} (user_id=${existingAuthUser.id})`,
    );
    if (!apply) {
      log("  [dry-run] would reset password from EHS_SHANE_SHORT_LOGIN_PASSWORD");
      log(`  [dry-run] would create active engineer profile and tenant membership`);
      return;
    }

    await updateAuthLogin(admin, existingAuthUser.id);
    await upsertEngineerRows(admin, existingAuthUser.id);
    log("Repaired existing short auth user with CRM rows.");
    return;
  }

  if (!apply) {
    log(`Short login missing: ${SHANE_SHORT_LOGIN.email}`);
    log(`  [dry-run] would create auth user, active engineer profile, and tenant membership`);
    log("  [dry-run] password would be read from EHS_SHANE_SHORT_LOGIN_PASSWORD");
    return;
  }

  const userId = await createShortLogin(admin);
  log("");
  log("NEW SHORT LOGIN CREATED");
  log(`  Email:    ${SHANE_SHORT_LOGIN.email}`);
  log("  Password: set from EHS_SHANE_SHORT_LOGIN_PASSWORD");
  log(`  user_id:  ${userId}`);
}

main().catch((error) => {
  console.error("FAILED:", error?.message ?? error);
  process.exit(1);
});
