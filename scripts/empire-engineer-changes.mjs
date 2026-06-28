/**
 * One-off operator script for the Empire Home Solutions tenant.
 *
 * What it does (idempotent):
 *   1. Removes existing engineers per their target action:
 *        - Amina Rahman → DEACTIVATE (user_profiles.active=false +
 *          tenant_memberships.active=false). Removes login access entirely.
 *        - Shaz Iqbal   → DEMOTE (user_profiles.role engineer→management
 *          and tenant_memberships.role engineer→management). Preserves
 *          admin/settings access; just hides from the engineer dropdown.
 *          (Required because Shaz is the owner-operator — full
 *          deactivation would lock them out of the CRM.)
 *
 *   2. Ensures Shane exists as an active engineer using the short login:
 *        Shane <shane@ehs.local>
 *      If the old shane@empirehomesolutions.local profile exists, it is
 *      left in place so both logins can be used.
 *
 * Safety:
 *   - Dry-run by default. Pass --apply to write.
 *   - Re-running with --apply is safe: already-deactivated rows skip the
 *     update, already-demoted rows skip the demotion, and the short Shane
 *     login is updated in place when it already exists.
 *
 * Run:
 *   node scripts/empire-engineer-changes.mjs          # dry-run preview
 *   EHS_SHANE_SHORT_LOGIN_PASSWORD="..." node scripts/empire-engineer-changes.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";
import { requireCrmScriptConfig } from "./crm-env.mjs";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_LABEL = "Empire Home Solutions";

const REMOVALS = [
  { fullName: "Amina Rahman", action: "deactivate" },
  // Demote (not deactivate) — Shaz is the owner-operator. Full
  // tenant_memberships.active=false would remove their login.
  { fullName: "Shaz Iqbal", action: "demote", newRole: "management" },
];

const NEW_ENGINEER = {
  fullName: "Shane",
  email: "shane@ehs.local",
  legacyEmail: "shane@empirehomesolutions.local",
  phone: "07740 017130",
  role: "engineer",
};

const apply = process.argv.includes("--apply");
const shortLoginPassword = process.env.EHS_SHANE_SHORT_LOGIN_PASSWORD ?? "";

function log(...args) {
  console.log(...args);
}

async function findProfileByName(admin, fullName) {
  const { data, error } = await admin
    .schema("crm")
    .from("user_profiles")
    .select("id, user_id, full_name, role, active, email")
    .eq("tenant_id", TENANT_ID)
    .ilike("full_name", fullName)
    .maybeSingle();
  if (error) throw error;
  return data;
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

async function deactivateProfile(admin, profile) {
  if (!profile.active) {
    log(`    already inactive — skipping`);
    return;
  }
  if (!apply) {
    log(`    [dry-run] would set user_profiles.active=false + tenant_memberships.active=false`);
    return;
  }

  const [{ error: profileError }, { error: membershipError }] = await Promise.all([
    admin
      .schema("crm")
      .from("user_profiles")
      .update({ active: false })
      .eq("tenant_id", TENANT_ID)
      .eq("user_id", profile.user_id),
    admin
      .schema("crm")
      .from("tenant_memberships")
      .update({ active: false })
      .eq("tenant_id", TENANT_ID)
      .eq("user_id", profile.user_id),
  ]);
  if (profileError) throw profileError;
  if (membershipError) throw membershipError;
  log(`    deactivated.`);
}

async function demoteProfile(admin, profile, newRole) {
  if (profile.role !== "engineer") {
    log(`    already role=${profile.role} (not engineer) — skipping demotion`);
    return;
  }
  if (!apply) {
    log(`    [dry-run] would set user_profiles.role=${newRole} + tenant_memberships.role=${newRole}`);
    log(`    [dry-run] active flags untouched — login preserved`);
    return;
  }

  const [{ error: profileError }, { error: membershipError }] = await Promise.all([
    admin
      .schema("crm")
      .from("user_profiles")
      .update({ role: newRole })
      .eq("tenant_id", TENANT_ID)
      .eq("user_id", profile.user_id),
    admin
      .schema("crm")
      .from("tenant_memberships")
      .update({ role: newRole })
      .eq("tenant_id", TENANT_ID)
      .eq("user_id", profile.user_id),
  ]);
  if (profileError) throw profileError;
  if (membershipError) throw membershipError;
  log(`    demoted engineer → ${newRole}. Login + admin access preserved.`);
}

async function ensureNewEngineer(admin) {
  const existingByEmail = await findProfileByEmail(admin, NEW_ENGINEER.email);
  if (existingByEmail) {
    log(`  Shane already exists (user_id=${existingByEmail.user_id}, active=${existingByEmail.active})`);
    if (!apply) {
      log(`  [dry-run] would ensure role=engineer, active=true, phone=${NEW_ENGINEER.phone}`);
      log(`  [dry-run] would reset auth password to the configured Shane password`);
      return;
    }
    await updateEngineerAuthLogin(admin, existingByEmail.user_id, NEW_ENGINEER.email);
    await upsertEngineerRows(admin, existingByEmail.user_id);
    log(`  updated existing Shane profile, membership, and password.`);
    return;
  }

  const existingByLegacyEmail = await findProfileByEmail(admin, NEW_ENGINEER.legacyEmail);
  if (existingByLegacyEmail) {
    log(
      `  Legacy Shane login exists at ${NEW_ENGINEER.legacyEmail} (user_id=${existingByLegacyEmail.user_id}); preserving it.`,
    );
  }

  if (!apply) {
    log(
      `  [dry-run] would create auth.users + crm.user_profiles + tenant_memberships for ${NEW_ENGINEER.email}`,
    );
    log(`  [dry-run] would set the configured Shane password`);
    return;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: NEW_ENGINEER.email,
    password: getShortLoginPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: NEW_ENGINEER.fullName,
      created_by_tenant_id: TENANT_ID,
    },
  });
  if (createError || !created.user) {
    throw new Error(`createUser failed: ${createError?.message ?? "unknown"}`);
  }
  const userId = created.user.id;

  try {
    await upsertEngineerRows(admin, userId);
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }

  log("");
  log("  =================================================================");
  log("  NEW ENGINEER CREATED");
  log("  -----------------------------------------------------------------");
  log(`  Email:    ${NEW_ENGINEER.email}`);
  log("  Password: set from EHS_SHANE_SHORT_LOGIN_PASSWORD");
  log(`  user_id:  ${userId}`);
  log("  =================================================================");
  log("");
}

async function updateEngineerAuthLogin(admin, userId, email) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email,
    password: getShortLoginPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: NEW_ENGINEER.fullName,
      created_by_tenant_id: TENANT_ID,
    },
  });
  if (error) {
    throw new Error(`updateUserById failed: ${error.message}`);
  }
}

function getShortLoginPassword() {
  if (!shortLoginPassword) {
    throw new Error("Set EHS_SHANE_SHORT_LOGIN_PASSWORD before applying Shane login changes.");
  }
  return shortLoginPassword;
}

async function upsertEngineerRows(admin, userId) {
  const { error: profileError } = await admin.schema("crm").from("user_profiles").upsert(
    {
      tenant_id: TENANT_ID,
      user_id: userId,
      role: NEW_ENGINEER.role,
      full_name: NEW_ENGINEER.fullName,
      phone: NEW_ENGINEER.phone,
      email: NEW_ENGINEER.email.toLowerCase(),
      active: true,
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (profileError) throw profileError;

  const { error: membershipError } = await admin.schema("crm").from("tenant_memberships").upsert(
    {
      tenant_id: TENANT_ID,
      user_id: userId,
      role: NEW_ENGINEER.role,
      active: true,
      is_owner: false,
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (membershipError) throw membershipError;
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = requireCrmScriptConfig(true);

  log(`empire-engineer-changes.mjs`);
  log(`  mode:        ${apply ? "APPLY (will write)" : "DRY RUN (no changes will be written)"}`);
  log(`  Supabase:    ${supabaseUrl}`);
  log(`  Tenant:      ${TENANT_LABEL} (${TENANT_ID})`);
  log("");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  log("Engineer removals:");
  for (const target of REMOVALS) {
    log(`  ${target.fullName} (action: ${target.action}${target.newRole ? " → " + target.newRole : ""})`);
    const profile = await findProfileByName(admin, target.fullName);
    if (!profile) {
      log(`    NOT FOUND in tenant — skipping.`);
      continue;
    }
    log(`    user_id=${profile.user_id} role=${profile.role} active=${profile.active}`);
    if (target.action === "deactivate") {
      await deactivateProfile(admin, profile);
    } else if (target.action === "demote") {
      await demoteProfile(admin, profile, target.newRole);
    } else {
      throw new Error(`Unknown action: ${target.action}`);
    }
  }

  log("");
  log("New engineer:");
  log(
    `  ${NEW_ENGINEER.fullName} <${NEW_ENGINEER.email}> phone=${NEW_ENGINEER.phone} role=${NEW_ENGINEER.role}`,
  );
  await ensureNewEngineer(admin);

  if (!apply) {
    log("");
    log("Dry run complete. Re-run with --apply to write.");
  } else {
    log("");
    log("Done.");
  }
}

main().catch((error) => {
  console.error("FAILED:", error?.message ?? error);
  process.exit(1);
});
