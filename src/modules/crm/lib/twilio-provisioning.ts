import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tenant } from "@/modules/crm/types";
import { getCrmEnv } from "@/modules/crm/lib/env";
import {
  fetchCustomerJourneysRuntimeSurface,
  getCustomerJourneysRuntimeLink,
  type CustomerJourneysRuntimeLink,
  type CustomerJourneysRuntimeSurface,
} from "@/modules/crm/lib/customerjourneys";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
const TWILIO_MESSAGING_BASE = "https://messaging.twilio.com/v1";

type TwilioState = {
  tenant_id: string;
  messaging_service_sid: string | null;
  voice_number_sid: string | null;
  voice_number_e164: string | null;
  whatsapp_sender_id: string | null;
  whatsapp_status:
    | "not_started"
    | "pending_review"
    | "approved"
    | "rejected"
    | "manual";
  last_synced_at: string | null;
  last_error: string | null;
  provisioning_log: Array<{ at: string; step: string; detail?: unknown }>;
};

export type TwilioProvisioningWarning = {
  step: string;
  message: string;
};

export type TwilioProvisioningResult = {
  state: TwilioState | null;
  runtime: CustomerJourneysRuntimeSurface | null;
  warnings: TwilioProvisioningWarning[];
  allChannelsReady: boolean;
};

type TenantRef = Pick<Tenant, "id" | "name" | "slug">;

function requireTwilio() {
  const env = getCrmEnv();
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    throw new Error("Twilio provisioning is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
  }
  return {
    accountSid: env.twilioAccountSid,
    authToken: env.twilioAuthToken,
    numberPoolSid: env.twilioDefaultNumberPoolSid,
  };
}

function requireCjControlPlane() {
  const env = getCrmEnv();
  if (!env.customerJourneysPlatformApiBaseUrl || !env.customerJourneysInternalApiToken) {
    throw new Error(
      "CustomerJourneys internal control plane is not configured (CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL / CUSTOMERJOURNEYS_INTERNAL_API_TOKEN).",
    );
  }
  return {
    baseUrl: env.customerJourneysPlatformApiBaseUrl.replace(/\/+$/, ""),
    token: env.customerJourneysInternalApiToken,
  };
}

function twilioBasicAuth(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function twilioFetch<T = unknown>(
  url: string,
  init: RequestInit & { accountSid: string; authToken: string },
): Promise<T> {
  const { accountSid, authToken, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: {
      authorization: twilioBasicAuth(accountSid, authToken),
      accept: "application/json",
      ...(rest.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : text) || `Twilio request failed: ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

async function cjInternalFetch<T = unknown>(
  path: string,
  init: RequestInit & { baseUrl: string; token: string },
): Promise<T> {
  const { baseUrl, token, ...rest } = init;
  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      "x-internal-service-token": token,
      accept: "application/json",
      ...(rest.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : text) || `CJ internal request failed: ${response.status}`;
    throw new Error(`${path}: ${message}`);
  }
  return body as T;
}

async function loadTwilioState(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TwilioState | null> {
  const { data, error } = await supabase
    .schema("crm")
    .from("tenant_twilio_state")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle<TwilioState>();
  if (error) throw error;
  return data ?? null;
}

async function upsertTwilioState(
  supabase: SupabaseClient,
  input: Partial<TwilioState> & { tenant_id: string },
): Promise<TwilioState> {
  const { data, error } = await supabase
    .schema("crm")
    .from("tenant_twilio_state")
    .upsert({ ...input, last_synced_at: new Date().toISOString() }, { onConflict: "tenant_id" })
    .select("*")
    .single<TwilioState>();
  if (error) throw error;
  return data;
}

function appendLog(
  current: TwilioState | null,
  step: string,
  detail?: unknown,
): TwilioState["provisioning_log"] {
  const existing = current?.provisioning_log ?? [];
  const entry = { at: new Date().toISOString(), step, detail };
  return [...existing, entry].slice(-50);
}

/**
 * Creates a Twilio Messaging Service for this tenant (idempotent: reuses the SID
 * already stored on tenant_twilio_state if present).
 */
export async function createMessagingServiceForTenant(
  supabase: SupabaseClient,
  tenant: TenantRef,
): Promise<string> {
  const twilio = requireTwilio();
  const existing = await loadTwilioState(supabase, tenant.id);
  if (existing?.messaging_service_sid) {
    return existing.messaging_service_sid;
  }

  const form = new URLSearchParams();
  form.set("FriendlyName", `CRM tenant: ${tenant.slug}`);
  form.set("InboundRequestUrl", "");
  form.set("UseInboundWebhookOnNumber", "true");

  const body = await twilioFetch<{ sid?: string }>(
    `${TWILIO_MESSAGING_BASE}/Services`,
    {
      method: "POST",
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      accountSid: twilio.accountSid,
      authToken: twilio.authToken,
    },
  );

  const sid = body.sid;
  if (!sid) {
    throw new Error("Twilio did not return a Messaging Service SID.");
  }

  await upsertTwilioState(supabase, {
    tenant_id: tenant.id,
    messaging_service_sid: sid,
    provisioning_log: appendLog(existing, "createMessagingService", { sid }),
    last_error: null,
  });
  return sid;
}

/**
 * Assigns a phone number to this tenant. If TWILIO_DEFAULT_NUMBER_POOL_SID is set
 * we treat it as a pre-purchased pool (the SID identifies the Messaging Service
 * or AvailablePhoneNumbers resource to draw from); otherwise this is a no-op and
 * the caller must attach a number manually.
 *
 * For the initial implementation we support the pool-of-pre-purchased-numbers
 * flow: any UK number not already attached to a Messaging Service can be moved
 * under this tenant's Messaging Service.
 */
export async function purchaseOrAssignNumberForTenant(
  supabase: SupabaseClient,
  tenant: TenantRef,
  messagingServiceSid: string,
): Promise<{ phoneNumberSid: string | null; e164: string | null; warning: string | null }> {
  const twilio = requireTwilio();
  const existing = await loadTwilioState(supabase, tenant.id);
  if (existing?.voice_number_sid && existing.voice_number_e164) {
    return {
      phoneNumberSid: existing.voice_number_sid,
      e164: existing.voice_number_e164,
      warning: null,
    };
  }

  if (!twilio.numberPoolSid) {
    return {
      phoneNumberSid: null,
      e164: null,
      warning:
        "No TWILIO_DEFAULT_NUMBER_POOL_SID configured. Assign a phone number to the tenant manually, then call reprovision.",
    };
  }

  // List IncomingPhoneNumbers not yet attached to any Messaging Service, pick the first GB one.
  const listed = await twilioFetch<{
    incoming_phone_numbers?: Array<{ sid: string; phone_number: string; capabilities?: { voice?: boolean; sms?: boolean }; messaging_service_sid?: string | null }>;
  }>(
    `${TWILIO_API_BASE}/Accounts/${twilio.accountSid}/IncomingPhoneNumbers.json?PageSize=50`,
    {
      method: "GET",
      accountSid: twilio.accountSid,
      authToken: twilio.authToken,
    },
  );
  const candidate = (listed.incoming_phone_numbers ?? []).find(
    (n) => n.capabilities?.sms && n.capabilities?.voice && !n.messaging_service_sid,
  );
  if (!candidate) {
    return {
      phoneNumberSid: null,
      e164: null,
      warning:
        "Twilio number pool is empty (no unattached voice+sms numbers found). Top up the pool or assign a number manually.",
    };
  }

  const form = new URLSearchParams();
  form.set("PhoneNumberSid", candidate.sid);
  await twilioFetch(
    `${TWILIO_MESSAGING_BASE}/Services/${messagingServiceSid}/PhoneNumbers`,
    {
      method: "POST",
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      accountSid: twilio.accountSid,
      authToken: twilio.authToken,
    },
  );

  await upsertTwilioState(supabase, {
    tenant_id: tenant.id,
    voice_number_sid: candidate.sid,
    voice_number_e164: candidate.phone_number,
    provisioning_log: appendLog(existing, "assignPhoneNumber", {
      sid: candidate.sid,
      e164: candidate.phone_number,
    }),
    last_error: null,
  });

  return {
    phoneNumberSid: candidate.sid,
    e164: candidate.phone_number,
    warning: null,
  };
}

/**
 * Records the WhatsApp Sender intent for this tenant. Actually registering a
 * Sender requires Meta review (async) and may need manual brand verification,
 * so this helper only captures the state. Callers should also attach the sender
 * to the CJ tenant via the CJ admin endpoint once Meta has approved it.
 */
export async function registerWhatsAppSender(
  supabase: SupabaseClient,
  tenant: TenantRef,
  e164: string | null,
): Promise<{ senderId: string | null; warning: string | null }> {
  const existing = await loadTwilioState(supabase, tenant.id);
  if (existing?.whatsapp_sender_id) {
    return { senderId: existing.whatsapp_sender_id, warning: null };
  }

  if (!e164) {
    await upsertTwilioState(supabase, {
      tenant_id: tenant.id,
      whatsapp_status: "not_started",
      provisioning_log: appendLog(existing, "registerWhatsAppSender.skipped", {
        reason: "no phone number",
      }),
    });
    return {
      senderId: null,
      warning: "No phone number attached yet; skipping WhatsApp Sender registration.",
    };
  }

  await upsertTwilioState(supabase, {
    tenant_id: tenant.id,
    whatsapp_status: "pending_review",
    provisioning_log: appendLog(existing, "registerWhatsAppSender.pending", { e164 }),
  });
  return {
    senderId: null,
    warning:
      "WhatsApp Sender registration is pending Meta review. Approve the sender in Twilio Console, then call 'reprovision Twilio' to record the sender id.",
  };
}

async function attachMessagingToCjTenant(
  cj: ReturnType<typeof requireCjControlPlane>,
  cjTenantId: string,
  twilio: ReturnType<typeof requireTwilio>,
  messagingServiceSid: string,
  phoneNumber: string | null,
) {
  await cjInternalFetch(`/v1/internal/crm/tenants/${cjTenantId}/messaging-connection`, {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      twilioAccountSid: twilio.accountSid,
      twilioAuthToken: twilio.authToken,
      messagingServiceSid,
      phoneNumber,
      smsEnabled: true,
      whatsappEnabled: true,
    }),
    baseUrl: cj.baseUrl,
    token: cj.token,
  });
}

async function attachVoiceToCjTenant(
  cj: ReturnType<typeof requireCjControlPlane>,
  cjTenantId: string,
  twilio: ReturnType<typeof requireTwilio>,
  phoneNumberSid: string,
  e164: string,
) {
  await cjInternalFetch(`/v1/internal/crm/tenants/${cjTenantId}/voice-connection`, {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      twilioAccountSid: twilio.accountSid,
      twilioAuthToken: twilio.authToken,
      phoneNumberSid,
      phoneNumberE164: e164,
    }),
    baseUrl: cj.baseUrl,
    token: cj.token,
  });
}

async function attachWhatsAppSenderToCjTenant(
  cj: ReturnType<typeof requireCjControlPlane>,
  cjTenantId: string,
  senderId: string,
  displayNumber: string | null,
) {
  await cjInternalFetch(`/v1/internal/crm/tenants/${cjTenantId}/whatsapp-sender`, {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      senderSid: senderId,
      displayNumber,
    }),
    baseUrl: cj.baseUrl,
    token: cj.token,
  });
}

function allChannelsReady(runtime: CustomerJourneysRuntimeSurface | null) {
  if (!runtime) return false;
  const { channels } = runtime;
  return (
    channels.webchat.ready &&
    channels.sms.ready &&
    channels.whatsapp.ready &&
    channels.voice.ready
  );
}

async function waitForRuntimeReady(
  link: CustomerJourneysRuntimeLink,
  maxAttempts = 6,
  intervalMs = 1500,
): Promise<CustomerJourneysRuntimeSurface | null> {
  let last: CustomerJourneysRuntimeSurface | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    last = await fetchCustomerJourneysRuntimeSurface(link).catch(() => null);
    if (allChannelsReady(last)) return last;
    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return last;
}

/**
 * Idempotent orchestrator: ensures the Twilio artifacts exist for the tenant,
 * ensures they are attached to the tenant's CJ tenant via the internal
 * CustomerJourneys control plane,
 * then polls the CJ runtime surface until all channels are ready (or surfaces
 * warnings if not).
 */
export async function ensureTenantTwilioProvisioning(
  supabase: SupabaseClient,
  tenant: TenantRef,
): Promise<TwilioProvisioningResult> {
  const env = getCrmEnv();
  const warnings: TwilioProvisioningWarning[] = [];

  if (!env.twilioProvisioningEnabled) {
    warnings.push({
      step: "preflight",
      message: "Twilio provisioning is not configured; skipping (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set).",
    });
    return { state: null, runtime: null, warnings, allChannelsReady: false };
  }

  const link = await getCustomerJourneysRuntimeLink(supabase, tenant.id);
  if (!link?.customerjourneys_tenant_id) {
    warnings.push({
      step: "preflight",
      message:
        "No CustomerJourneys runtime link for this tenant. Run ensureCustomerJourneysRuntimeLink first.",
    });
    return { state: null, runtime: null, warnings, allChannelsReady: false };
  }

  let state: TwilioState | null = await loadTwilioState(supabase, tenant.id);

  // 1. Messaging Service.
  let messagingServiceSid = state?.messaging_service_sid ?? null;
  try {
    messagingServiceSid = await createMessagingServiceForTenant(supabase, tenant);
  } catch (error) {
    warnings.push({
      step: "createMessagingService",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. Phone number (voice + sms).
  let voiceNumberSid = state?.voice_number_sid ?? null;
  let voiceNumberE164 = state?.voice_number_e164 ?? null;
  if (messagingServiceSid) {
    try {
      const assignment = await purchaseOrAssignNumberForTenant(supabase, tenant, messagingServiceSid);
      voiceNumberSid = assignment.phoneNumberSid ?? voiceNumberSid;
      voiceNumberE164 = assignment.e164 ?? voiceNumberE164;
      if (assignment.warning) {
        warnings.push({ step: "assignPhoneNumber", message: assignment.warning });
      }
    } catch (error) {
      warnings.push({
        step: "assignPhoneNumber",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 3. WhatsApp sender intent.
  let whatsappSenderId = state?.whatsapp_sender_id ?? null;
  try {
    const wa = await registerWhatsAppSender(supabase, tenant, voiceNumberE164);
    whatsappSenderId = wa.senderId ?? whatsappSenderId;
    if (wa.warning) {
      warnings.push({ step: "registerWhatsAppSender", message: wa.warning });
    }
  } catch (error) {
    warnings.push({
      step: "registerWhatsAppSender",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // 4. Attach to the linked platform tenant via the internal control plane.
  try {
    const cj = requireCjControlPlane();
    const twilio = requireTwilio();
    if (messagingServiceSid) {
      try {
        await attachMessagingToCjTenant(
          cj,
          link.customerjourneys_tenant_id,
          twilio,
          messagingServiceSid,
          voiceNumberE164,
        );
      } catch (error) {
        warnings.push({
          step: "cj.attachMessaging",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (voiceNumberSid && voiceNumberE164) {
      try {
        await attachVoiceToCjTenant(cj, link.customerjourneys_tenant_id, twilio, voiceNumberSid, voiceNumberE164);
      } catch (error) {
        warnings.push({
          step: "cj.attachVoice",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (whatsappSenderId) {
      try {
        await attachWhatsAppSenderToCjTenant(
          cj,
          link.customerjourneys_tenant_id,
          whatsappSenderId,
          voiceNumberE164,
        );
      } catch (error) {
        warnings.push({
          step: "cj.attachWhatsApp",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    warnings.push({
      step: "cj.preflight",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // 5. Poll until CJ reports the channels ready (best-effort).
  const runtime = await waitForRuntimeReady(link);
  const ready = allChannelsReady(runtime);
  if (!ready) {
    if (runtime?.issues?.length) {
      for (const issue of runtime.issues) {
        warnings.push({ step: "cj.readiness", message: issue });
      }
    } else {
      warnings.push({
        step: "cj.readiness",
        message: "Not all channels reported ready after provisioning; re-run after a short delay.",
      });
    }
  }

  // Persist final state snapshot + last_error summary.
  const errSummary = warnings.length ? warnings.map((w) => `${w.step}: ${w.message}`).join("\n") : null;
  state = await upsertTwilioState(supabase, {
    tenant_id: tenant.id,
    messaging_service_sid: messagingServiceSid,
    voice_number_sid: voiceNumberSid,
    voice_number_e164: voiceNumberE164,
    whatsapp_sender_id: whatsappSenderId,
    last_error: errSummary,
    provisioning_log: appendLog(state, "ensureTenantTwilioProvisioning", { ready }),
  });

  return { state, runtime, warnings, allChannelsReady: ready };
}
