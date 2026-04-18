#!/usr/bin/env node
/**
 * Phase 1 onboarding reference: provision a clean CJ tenant for Empire, attach
 * the Twilio Messaging Service + voice binding + WhatsApp Sender, verify the
 * runtime surface is fully green, and repoint the CRM runtime link.
 *
 * This script is the executable form of the "manual, one-off" part of the
 * Multi-Tenant Agent Onboarding Plan. Every later tenant goes through the
 * automated server-side path (ensureTenantTwilioProvisioning); this script is
 * only here so Empire can reach the same state today without that automation
 * having run.
 *
 * Required env (beyond .env.local):
 *   CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL     (already in .env.local)
 *   CUSTOMERJOURNEYS_ADMIN_API_TOKEN           (bearer for CJ admin endpoints)
 *   CUSTOMERJOURNEYS_INTERNAL_API_TOKEN        (for test-surface)
 *   NEXT_PUBLIC_SUPABASE_URL                   (already in .env.local)
 *   SUPABASE_SERVICE_ROLE_KEY                  (already in .env.local)
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   EMPIRE_MESSAGING_SERVICE_SID               (existing MG... SID for Empire SMS/WA)
 *   EMPIRE_VOICE_NUMBER_E164=+447401248976     (voice phone number)
 *   EMPIRE_VOICE_NUMBER_SID                    (PN... SID; Twilio IncomingPhoneNumber)
 *   EMPIRE_WHATSAPP_SENDER_ID                  (XE... WA Sender SID, pre-registered)
 *
 * Invocation (dry run):
 *   node scripts/onboarding/empire-reference-migration.mjs --dry-run
 * Invocation (execute):
 *   node scripts/onboarding/empire-reference-migration.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const DRY_RUN = process.argv.includes("--dry-run");
const CRM_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const NEW_CJ_SLUG = "empire-home-solutions";
const NEW_CJ_NAME = "Empire Home Solutions";
const NEW_CJ_TIMEZONE = "Europe/London";
const NEW_CJ_VERTICAL = "plumbing";

function loadEnvFile(path) {
  try {
    const contents = readFileSync(path, "utf8");
    for (const line of contents.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key] === undefined) {
        process.env[key] = raw.replace(/^"|"$/g, "");
      }
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const requiredEnv = [
  "CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL",
  "CUSTOMERJOURNEYS_ADMIN_API_TOKEN",
  "CUSTOMERJOURNEYS_INTERNAL_API_TOKEN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EMPIRE_MESSAGING_SERVICE_SID",
  "EMPIRE_VOICE_NUMBER_E164",
  "EMPIRE_VOICE_NUMBER_SID",
];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0 && !DRY_RUN) {
  console.error("Missing required env vars:\n  - " + missing.join("\n  - "));
  console.error("\nSet them (or run with --dry-run to preview).");
  process.exit(1);
}

const base = (process.env.CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL ?? "").replace(/\/+$/, "");
const adminToken = process.env.CUSTOMERJOURNEYS_ADMIN_API_TOKEN ?? "";
const internalToken = process.env.CUSTOMERJOURNEYS_INTERNAL_API_TOKEN ?? "";
const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function cjFetch(path, init = {}) {
  const url = `${base}${path}`;
  if (DRY_RUN) {
    console.log(`[dry-run] ${init.method ?? "GET"} ${url}`);
    if (init.body) console.log(`          body: ${init.body}`);
    return { ok: true, json: async () => ({ dry: true }) };
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`CJ ${init.method ?? "GET"} ${path} failed: ${res.status} ${text}`);
  }
  return { ok: true, json: async () => json };
}

async function supaPatch(path, payload) {
  const url = `${supaUrl}/rest/v1${path}`;
  if (DRY_RUN) {
    console.log(`[dry-run] PATCH ${url}`);
    console.log(`          body: ${JSON.stringify(payload)}`);
    return;
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: supaKey,
      Authorization: `Bearer ${supaKey}`,
      "Content-Profile": "crm",
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase PATCH ${path} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : [];
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== EXECUTING ===");

  // 1. Provision fresh CJ tenant.
  console.log("\n[1/6] Provisioning CJ tenant empire-home-solutions...");
  const provisionRes = await cjFetch("/v1/admin/tenants", {
    method: "POST",
    body: JSON.stringify({
      slug: NEW_CJ_SLUG,
      name: NEW_CJ_NAME,
      timezone: NEW_CJ_TIMEZONE,
      verticalKey: NEW_CJ_VERTICAL,
      adminRole: "tenant_admin",
      featureFlags: {
        managed_text_agent_sms: true,
        managed_text_agent_whatsapp: true,
        managed_text_agent_webchat: true,
        managed_voice_agent: true,
      },
    }),
  });
  const provisioned = await provisionRes.json();
  const newCjTenantId = DRY_RUN ? "<new-cj-tenant-id>" : provisioned.tenant?.id;
  if (!newCjTenantId) {
    throw new Error(`Provisioning returned no tenant id: ${JSON.stringify(provisioned)}`);
  }
  console.log(`      -> ${newCjTenantId}`);

  // 2. Attach messaging connection.
  console.log("\n[2/6] Attaching Twilio Messaging Service to CJ tenant...");
  await cjFetch(`/v1/admin/tenants/${newCjTenantId}/messaging-connection`, {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      messagingServiceSid: process.env.EMPIRE_MESSAGING_SERVICE_SID,
      smsEnabled: true,
      whatsappEnabled: true,
    }),
  });

  // 3. Attach voice connection.
  console.log("\n[3/6] Attaching voice binding for " + (process.env.EMPIRE_VOICE_NUMBER_E164 ?? "<number>") + "...");
  await cjFetch(`/v1/admin/tenants/${newCjTenantId}/voice-connection`, {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumberSid: process.env.EMPIRE_VOICE_NUMBER_SID,
      phoneNumberE164: process.env.EMPIRE_VOICE_NUMBER_E164,
    }),
  });

  // 4. Attach WhatsApp sender (optional, depends on Meta approval state).
  if (process.env.EMPIRE_WHATSAPP_SENDER_ID) {
    console.log("\n[4/6] Attaching WhatsApp Sender...");
    await cjFetch(`/v1/admin/tenants/${newCjTenantId}/whatsapp-sender`, {
      method: "POST",
      body: JSON.stringify({
        provider: "twilio",
        senderSid: process.env.EMPIRE_WHATSAPP_SENDER_ID,
        displayNumber: process.env.EMPIRE_VOICE_NUMBER_E164,
      }),
    });
  } else {
    console.log("\n[4/6] Skipping WhatsApp Sender (EMPIRE_WHATSAPP_SENDER_ID not set).");
  }

  // 5. Verify readiness via the internal test-surface.
  console.log("\n[5/6] Verifying /v1/internal/tenants/" + newCjTenantId + "/test-surface...");
  if (!DRY_RUN) {
    const verifyRes = await fetch(
      `${base}/v1/internal/tenants/${newCjTenantId}/test-surface`,
      { headers: { "x-internal-service-token": internalToken } },
    );
    const surface = await verifyRes.json();
    console.log(JSON.stringify(surface, null, 2));
    const channels = surface.channels ?? {};
    const unready = Object.entries(channels).filter(([, v]) => !v.ready);
    if (unready.length > 0) {
      console.warn("\nWARNING: some channels are not ready yet:");
      for (const [name, v] of unready) console.warn(`  - ${name}: ${v.reason ?? "(no reason)"}`);
      console.warn("(Re-run verification after the WhatsApp Sender has cleared Meta review.)");
    } else {
      console.log("\nAll channels READY.");
    }
  }

  // 6. Repoint the CRM runtime link.
  console.log("\n[6/6] Repointing crm.customerjourneys_runtime_links for tenant 1...");
  await supaPatch(
    `/customerjourneys_runtime_links?crm_tenant_id=eq.${CRM_TENANT_ID}`,
    { customerjourneys_tenant_id: newCjTenantId },
  );

  console.log("\nDone. The /test page should now reflect the new CJ tenant on its next poll.");
  console.log("\nAfter verifying, retire the old CJ tenants (dk-plumbing / customerjourneys-isolated-production)");
  console.log("by calling DELETE /v1/admin/tenants/<id> on the CJ platform.");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
