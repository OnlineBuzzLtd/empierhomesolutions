export type FsmProviderKey = "none" | "servicem8" | "joblogic";

export type FsmConnectionTestResult = {
  ok: boolean;
  message: string;
};

export type FsmPushJobResult = {
  ok: boolean;
  externalId?: string | null;
  warning?: string | null;
};

export type FsmJobPayload = {
  appointment: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    external_fsm_id?: string | null;
  };
  job?: {
    id: string;
    title?: string | null;
    description?: string | null;
  } | null;
  customer?: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    postcode?: string | null;
  } | null;
};

export type FsmAdapter = {
  key: FsmProviderKey;
  label: string;
  isConfigured: (config: Record<string, unknown>) => boolean;
  testConnection: (config: Record<string, unknown>) => Promise<FsmConnectionTestResult>;
  pushJob?: (input: {
    tenantId: string;
    appointmentId: string;
    jobId?: string | null;
    config: Record<string, unknown>;
    payload?: FsmJobPayload;
  }) => Promise<FsmPushJobResult>;
};

const adapters = new Map<FsmProviderKey, FsmAdapter>();

function configString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveBaseUrl(config: Record<string, unknown>, fallback: string) {
  return (configString(config, "base_url") ?? fallback).replace(/\/$/, "");
}

async function parseProviderResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export function registerFsmAdapter(adapter: FsmAdapter) {
  adapters.set(adapter.key, adapter);
}

export function getFsmAdapter(key: FsmProviderKey) {
  return adapters.get(key) ?? adapters.get("none")!;
}

export function listFsmAdapters() {
  return [...adapters.values()];
}

registerFsmAdapter({
  key: "none",
  label: "None",
  isConfigured: () => true,
  testConnection: async () => ({ ok: true, message: "No FSM provider selected." }),
});

registerFsmAdapter({
  key: "servicem8",
  label: "ServiceM8",
  isConfigured: (config) => typeof config.api_key === "string" && config.api_key.trim().length > 0,
  testConnection: async (config) => {
    const apiKey = configString(config, "api_key");
    if (!apiKey) {
      return { ok: false, message: "ServiceM8 API key is missing." };
    }
    const response = await fetch(`${resolveBaseUrl(config, "https://api.servicem8.com/api_1.0")}/staff.json?$limit=1`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    return response.ok
      ? { ok: true, message: "ServiceM8 credentials validated." }
      : { ok: false, message: `ServiceM8 returned HTTP ${response.status}.` };
  },
  pushJob: async ({ config, payload }) => {
    const apiKey = configString(config, "api_key");
    if (!apiKey) {
      return { ok: false, warning: "ServiceM8 API key is missing." };
    }
    const body = {
      status: "Queue",
      job_description: payload?.job?.description ?? payload?.appointment.title ?? "CRM booking",
      job_address: [
        payload?.customer?.address_line1,
        payload?.customer?.address_line2,
        payload?.customer?.city,
        payload?.customer?.postcode,
      ]
        .filter(Boolean)
        .join(", "),
      billing_address: payload?.customer?.full_name ?? undefined,
      contact_first: payload?.customer?.full_name ?? undefined,
      contact_phone: payload?.customer?.phone ?? undefined,
      contact_email: payload?.customer?.email ?? undefined,
      generated_job_id: payload?.appointment.id,
    };
    const response = await fetch(`${resolveBaseUrl(config, "https://api.servicem8.com/api_1.0")}/job.json`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await parseProviderResponse(response);
    const externalId =
      typeof result.uuid === "string" ? result.uuid : typeof result.id === "string" ? result.id : null;
    return response.ok
      ? { ok: true, externalId, warning: externalId ? null : "ServiceM8 accepted the job without returning an id." }
      : { ok: false, warning: `ServiceM8 returned HTTP ${response.status}.` };
  },
});

registerFsmAdapter({
  key: "joblogic",
  label: "Joblogic",
  isConfigured: (config) => typeof config.api_key === "string" && config.api_key.trim().length > 0,
  testConnection: async (config) => {
    const apiKey = configString(config, "api_key");
    const baseUrl = configString(config, "base_url");
    if (!apiKey) {
      return { ok: false, message: "Joblogic API key is missing." };
    }
    if (!baseUrl) {
      return { ok: false, message: "Joblogic Base URL is required." };
    }
    const response = await fetch(`${resolveBaseUrl(config, baseUrl)}/api/v1/jobs?limit=1`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    return response.ok
      ? { ok: true, message: "Joblogic credentials validated." }
      : { ok: false, message: `Joblogic returned HTTP ${response.status}.` };
  },
  pushJob: async ({ config, payload }) => {
    const apiKey = configString(config, "api_key");
    const baseUrl = configString(config, "base_url");
    if (!apiKey || !baseUrl) {
      return { ok: false, warning: "Joblogic API key and Base URL are required." };
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    };
    const accountId = configString(config, "account_id");
    if (accountId) {
      headers["x-account-id"] = accountId;
    }
    const response = await fetch(`${resolveBaseUrl(config, baseUrl)}/api/v1/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        external_reference: payload?.appointment.id,
        summary: payload?.job?.title ?? payload?.appointment.title,
        description: payload?.job?.description ?? payload?.appointment.title,
        scheduled_start: payload?.appointment.starts_at,
        scheduled_end: payload?.appointment.ends_at,
        customer: {
          name: payload?.customer?.full_name,
          phone: payload?.customer?.phone,
          email: payload?.customer?.email,
          postcode: payload?.customer?.postcode,
          address_line1: payload?.customer?.address_line1,
          city: payload?.customer?.city,
        },
      }),
    });
    const result = await parseProviderResponse(response);
    const externalId =
      typeof result.id === "string"
        ? result.id
        : typeof result.job_id === "string"
          ? result.job_id
          : typeof result.reference === "string"
            ? result.reference
            : null;
    return response.ok
      ? { ok: true, externalId, warning: externalId ? null : "Joblogic accepted the job without returning an id." }
      : { ok: false, warning: `Joblogic returned HTTP ${response.status}.` };
  },
});
