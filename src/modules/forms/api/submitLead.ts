import { getServerEnv, publicEnv } from "@/lib/env";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import type { Attribution } from "@/modules/tracking/attribution";
import { z } from "zod";

const attributionSchema = z
  .object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
    gclid: z.string().optional(),
    msclkid: z.string().optional(),
    landing_url: z.string().optional(),
  })
  .optional()
  .default({});

export const leadRequestSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")).default(""),
  house_name_number: z.string().min(1),
  street: z.string().min(2),
  postcode: z.string().min(4),
  phone: z.string().min(10).max(15),
  issue: z.string().default(""),
  companyWebsite: z.string().optional().default(""),
  pagePath: z.string().min(1),
  service: z.string().optional(),
  location: z.string().optional(),
  leadType: z.enum(["repair", "install", "finance", "power-flush"]).default("repair"),
  origin: z.string().url(),
  attribution: attributionSchema,
});

export type LeadRequest = z.infer<typeof leadRequestSchema>;

function sanitizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isAllowedOrigin(origin: string) {
  if (origin === publicEnv.siteUrl) {
    return true;
  }

  try {
    const requestOrigin = new URL(origin);
    const allowedOrigin = new URL(publicEnv.siteUrl);
    const loopbackHosts = new Set(["localhost", "127.0.0.1"]);

    return (
      requestOrigin.protocol === allowedOrigin.protocol &&
      requestOrigin.port === allowedOrigin.port &&
      loopbackHosts.has(requestOrigin.hostname) &&
      loopbackHosts.has(allowedOrigin.hostname)
    );
  } catch {
    return false;
  }
}

function sanitizeAttribution(attribution: Attribution = {}) {
  return Object.fromEntries(
    Object.entries(attribution)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => [key, sanitizeText(String(value))]),
  );
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildAddressLine1(houseNameNumber: string, street: string) {
  return [sanitizeText(houseNameNumber), sanitizeText(street)].filter(Boolean).join(" ");
}

export function sanitizeLeadPayload(lead: LeadRequest) {
  const normalizedIssue = lead.issue ? sanitizeText(lead.issue) : "";
  const email = lead.email ? normalizeEmail(lead.email) : "";
  const addressLine1 = buildAddressLine1(lead.house_name_number, lead.street);

  return {
    name: sanitizeText(lead.name),
    email,
    house_name_number: sanitizeText(lead.house_name_number),
    street: sanitizeText(lead.street),
    address_line1: addressLine1,
    postcode: sanitizeText(lead.postcode.toUpperCase()),
    phone: normalizePhone(lead.phone),
    issue: normalizedIssue || "Not provided",
    leadType: lead.leadType,
    metadata: {
      timestamp: new Date().toISOString(),
      pagePath: sanitizeText(lead.pagePath),
      service: lead.service ? sanitizeText(lead.service) : "",
      location: lead.location ? sanitizeText(lead.location) : "",
    },
    attribution: sanitizeAttribution(lead.attribution),
  };
}

const serviceSlugByLeadType: Record<LeadRequest["leadType"], string | null> = {
  repair: "boilers",
  install: "boilers",
  finance: "boilers",
  "power-flush": "power-flushing",
};

const jobTypeSlugByLeadType: Record<LeadRequest["leadType"], string | null> = {
  repair: "boiler-repair",
  install: "boiler-install",
  finance: "boiler-install",
  "power-flush": "power-flush",
};

function buildLeadNotes(cleanPayload: ReturnType<typeof sanitizeLeadPayload>) {
  const noteLines = [
    `Website lead type: ${cleanPayload.leadType}`,
    `Issue: ${cleanPayload.issue}`,
    `Address: ${cleanPayload.address_line1}, ${cleanPayload.postcode}`,
  ];

  if (cleanPayload.email) {
    noteLines.push(`Email: ${cleanPayload.email}`);
  }

  if (cleanPayload.metadata.service) {
    noteLines.push(`Landing service: ${cleanPayload.metadata.service}`);
  }

  if (cleanPayload.metadata.location) {
    noteLines.push(`Landing location: ${cleanPayload.metadata.location}`);
  }

  const attributionLines = Object.entries(cleanPayload.attribution).map(([key, value]) => `${key}: ${value}`);
  if (attributionLines.length > 0) {
    noteLines.push(`Attribution: ${attributionLines.join(", ")}`);
  }

  return noteLines.join("\n");
}

async function submitLeadToCrm(lead: LeadRequest): Promise<LeadSubmitResult> {
  const crmEnv = getCrmEnv();
  if (!crmEnv.adminEnabled) {
    return {
      ok: false,
      status: 503,
      error: {
        code: "crm_not_configured",
        message: "CRM lead capture is not configured.",
      },
    };
  }

  const cleanPayload = sanitizeLeadPayload(lead);
  const admin = createCrmServiceRoleClient();
  const leadNotes = buildLeadNotes(cleanPayload);

  const serviceSlug = serviceSlugByLeadType[cleanPayload.leadType];
  const jobTypeSlug = jobTypeSlugByLeadType[cleanPayload.leadType];

  const [{ data: service }, { data: existingCustomer }] = await Promise.all([
    serviceSlug
      ? admin.schema("crm").from("services").select("id").eq("slug", serviceSlug).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .schema("crm")
      .from("customers")
      .select("id, notes, email, address_line1")
      .eq("phone", cleanPayload.phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const serviceId = service?.id ?? null;
  let jobTypeId: string | null = null;

  if (serviceId && jobTypeSlug) {
    const { data: jobType } = await admin
      .schema("crm")
      .from("job_types")
      .select("id")
      .eq("service_id", serviceId)
      .eq("slug", jobTypeSlug)
      .maybeSingle();

    jobTypeId = jobType?.id ?? null;
  }

  let customerId = existingCustomer?.id ?? null;

  if (!customerId) {
    const { data: customer, error: customerError } = await admin
      .schema("crm")
      .from("customers")
      .insert({
        full_name: cleanPayload.name,
        email: cleanPayload.email || null,
        phone: cleanPayload.phone,
        address_line1: cleanPayload.address_line1,
        postcode: cleanPayload.postcode,
        source: "Website booking form",
        notes: leadNotes,
      })
      .select("id")
      .single();

    if (customerError || !customer) {
      return {
        ok: false,
        status: 500,
        error: {
          code: "customer_create_failed",
          message: customerError?.message ?? "Customer record could not be created.",
        },
      };
    }

    customerId = customer.id;
  } else {
    const mergedNotes = [existingCustomer?.notes, leadNotes].filter(Boolean).join("\n\n");
    await admin
      .schema("crm")
      .from("customers")
      .update({
        full_name: cleanPayload.name,
        email: cleanPayload.email || existingCustomer?.email || null,
        address_line1: cleanPayload.address_line1 || existingCustomer?.address_line1 || null,
        postcode: cleanPayload.postcode,
        source: "Website booking form",
        notes: mergedNotes,
      })
      .eq("id", customerId);
  }

  const { data: createdLead, error: leadError } = await admin
    .schema("crm")
    .from("leads")
    .insert({
      customer_id: customerId,
      service_id: serviceId,
      job_type_id: jobTypeId,
      status: "new",
      source: cleanPayload.attribution.utm_source || "Website booking form",
      notes: leadNotes,
    })
    .select("id")
    .single();

  if (leadError || !createdLead) {
    return {
      ok: false,
      status: 500,
      error: {
        code: "lead_create_failed",
        message: leadError?.message ?? "Lead record could not be created.",
      },
    };
  }

  await admin.schema("crm").from("notes").insert([
    {
      entity_type: "customer",
      entity_id: customerId,
      body: `Website enquiry received.\n${leadNotes}`,
    },
    {
      entity_type: "lead",
      entity_id: createdLead.id,
      body: `Website enquiry received.\n${leadNotes}`,
    },
  ]);

  return { ok: true };
}

export type LeadSubmitResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: {
        code: string;
        message: string;
      };
    };

export async function submitLeadToWebhook(lead: LeadRequest): Promise<LeadSubmitResult> {
  if (!isAllowedOrigin(lead.origin)) {
    return {
      ok: false,
      status: 403,
      error: {
        code: "invalid_origin",
        message: "Origin is not allowed.",
      },
    };
  }

  if (lead.companyWebsite?.trim()) {
    return {
      ok: false,
      status: 422,
      error: {
        code: "spam_detected",
        message: "Spam validation failed.",
      },
    };
  }

  const crmSubmission = await submitLeadToCrm(lead);
  if (crmSubmission.ok) {
    return crmSubmission;
  }

  if (crmSubmission.error.code !== "crm_not_configured") {
    return crmSubmission;
  }

  const cleanPayload = sanitizeLeadPayload(lead);

  try {
    const serverEnv = getServerEnv();
    const webhookResponse = await fetch(serverEnv.formWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanPayload),
      cache: "no-store",
    });

    if (!webhookResponse.ok) {
      return {
        ok: false,
        status: 502,
        error: {
          code: "webhook_failed",
          message: `Webhook rejected request with status ${webhookResponse.status}.`,
        },
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: {
        code: "webhook_unreachable",
        message: "Webhook endpoint could not be reached.",
      },
    };
  }
}
