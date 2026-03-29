import { getServerEnv, publicEnv } from "@/lib/env";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import type { LeadCustomerMatchResult, LeadDedupeResult, LeadStatus } from "@/modules/crm/types";
import type { Attribution } from "@/modules/tracking/attribution";
import { z } from "zod";

const LANDING_PAGE_TENANT_SLUG = "empire-home-solutions";
const WEBSITE_INTAKE_SOURCE = "website";
const WEBSITE_CUSTOMER_SOURCE = "Website booking form";
const LEAD_DEDUPE_WINDOW_MINUTES = 15;
const openWebsiteLeadStatuses: LeadStatus[] = ["new", "contacted", "follow_up", "survey_booked", "quoted", "accepted"];

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

export function normalizeName(value: string) {
  return sanitizeText(value).toLowerCase();
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

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function normalizeEmail(value: string) {
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

type CleanLeadPayload = ReturnType<typeof sanitizeLeadPayload>;

type ExistingCustomerCandidate = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  postcode: string | null;
};

type ExistingLeadCandidate = {
  id: string;
  customer_id: string | null;
  status: LeadStatus;
  submission_count: number | null;
  first_submitted_at: string | null;
};

type CustomerMatchDecision = {
  customerId: string | null;
  possibleDuplicateCustomerId: string | null;
  customerMatchResult: LeadCustomerMatchResult;
  matchedCustomerConfidence: string;
  customerUpdate: Record<string, string | null>;
  matchedExistingCustomerHistory: boolean;
};

export function buildSubmissionFingerprint(cleanPayload: CleanLeadPayload) {
  return [
    normalizePhone(cleanPayload.phone),
    cleanPayload.leadType,
    normalizeName(cleanPayload.issue),
    normalizeName(cleanPayload.address_line1),
    normalizeName(cleanPayload.postcode),
  ].join("|");
}

function sameEmail(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && normalizeEmail(left) === normalizeEmail(right));
}

function sameName(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && normalizeName(left) === normalizeName(right));
}

export function determineCustomerMatch(
  cleanPayload: CleanLeadPayload,
  customers: ExistingCustomerCandidate[],
): CustomerMatchDecision {
  const strictMatch = customers.find(
    (customer) => sameEmail(customer.email, cleanPayload.email) || sameName(customer.full_name, cleanPayload.name),
  );

  if (strictMatch) {
    return {
      customerId: strictMatch.id,
      possibleDuplicateCustomerId: null,
      customerMatchResult: "matched",
      matchedCustomerConfidence: sameEmail(strictMatch.email, cleanPayload.email) ? "high" : "medium",
      customerUpdate: {
        email: strictMatch.email || cleanPayload.email || null,
        address_line1: strictMatch.address_line1 || cleanPayload.address_line1 || null,
        postcode: strictMatch.postcode || cleanPayload.postcode || null,
      },
      matchedExistingCustomerHistory: true,
    };
  }

  const possibleDuplicateCustomer = customers[0] ?? null;
  return {
    customerId: null,
    possibleDuplicateCustomerId: possibleDuplicateCustomer?.id ?? null,
    customerMatchResult: possibleDuplicateCustomer ? "possible_duplicate" : "new",
    matchedCustomerConfidence: possibleDuplicateCustomer ? "low" : "high",
    customerUpdate: {
      email: cleanPayload.email || null,
      address_line1: cleanPayload.address_line1,
      postcode: cleanPayload.postcode,
    },
    matchedExistingCustomerHistory: false,
  };
}

export function isWithinLeadDedupeWindow(submittedAt: Date, candidateTimestamp: string | null) {
  if (!candidateTimestamp) {
    return false;
  }

  const candidateTime = new Date(candidateTimestamp);
  if (Number.isNaN(candidateTime.getTime())) {
    return false;
  }

  return submittedAt.getTime() - candidateTime.getTime() <= LEAD_DEDUPE_WINDOW_MINUTES * 60 * 1000;
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

function buildWebsiteEnquiryNote(cleanPayload: CleanLeadPayload, options?: { matchedExistingCustomerHistory?: boolean; submissionCount?: number; deduped?: boolean }) {
  const lines = ["Website enquiry received."];

  if (options?.deduped) {
    lines.push(`This enquiry was submitted again. Submission count: ${options.submissionCount ?? 1}.`);
  }

  if (options?.matchedExistingCustomerHistory) {
    lines.push("Existing customer history found. Historical customer files remain separate from this enquiry.");
  }

  lines.push(buildLeadNotes(cleanPayload));
  return lines.join("\n");
}

async function createCustomer(
  admin: ReturnType<typeof createCrmServiceRoleClient>,
  tenantId: string,
  cleanPayload: CleanLeadPayload,
) {
  const { data: customer, error } = await admin
    .schema("crm")
    .from("customers")
    .insert({
      tenant_id: tenantId,
      full_name: cleanPayload.name,
      email: cleanPayload.email || null,
      phone: cleanPayload.phone,
      address_line1: cleanPayload.address_line1,
      postcode: cleanPayload.postcode,
      source: WEBSITE_CUSTOMER_SOURCE,
    })
    .select("id")
    .single();

  if (error || !customer) {
    throw new Error(error?.message ?? "Customer record could not be created.");
  }

  return customer.id;
}

async function resolveLandingPageTenantId(admin: ReturnType<typeof createCrmServiceRoleClient>) {
  const { data: tenant, error } = await admin
    .schema("crm")
    .from("tenants")
    .select("id")
    .eq("slug", LANDING_PAGE_TENANT_SLUG)
    .maybeSingle();

  if (error || !tenant) {
    throw new Error(error?.message ?? `Tenant ${LANDING_PAGE_TENANT_SLUG} could not be resolved.`);
  }

  return tenant.id;
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
  const submittedAt = new Date();
  const submissionFingerprint = buildSubmissionFingerprint(cleanPayload);
  let tenantId: string;

  try {
    tenantId = await resolveLandingPageTenantId(admin);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: {
        code: "tenant_resolve_failed",
        message: error instanceof Error ? error.message : "CRM tenant could not be resolved.",
      },
    };
  }

  const serviceSlug = serviceSlugByLeadType[cleanPayload.leadType];
  const jobTypeSlug = jobTypeSlugByLeadType[cleanPayload.leadType];

  const [{ data: service }, { data: existingCustomers }] = await Promise.all([
    serviceSlug
      ? admin.schema("crm").from("services").select("id").eq("tenant_id", tenantId).eq("slug", serviceSlug).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .schema("crm")
      .from("customers")
      .select("id, full_name, email, phone, address_line1, postcode")
      .eq("tenant_id", tenantId)
      .eq("phone", cleanPayload.phone)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const serviceId = service?.id ?? null;
  let jobTypeId: string | null = null;

  if (serviceId && jobTypeSlug) {
    const { data: jobType } = await admin
      .schema("crm")
      .from("job_types")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .eq("slug", jobTypeSlug)
      .maybeSingle();

    jobTypeId = jobType?.id ?? null;
  }

  const matchDecision = determineCustomerMatch(cleanPayload, (existingCustomers ?? []) as ExistingCustomerCandidate[]);
  let customerId = matchDecision.customerId;

  try {
    if (!customerId) {
      customerId = await createCustomer(admin, tenantId, cleanPayload);
    } else if (Object.keys(matchDecision.customerUpdate).length > 0) {
      await admin
        .schema("crm")
        .from("customers")
        .update(matchDecision.customerUpdate)
        .eq("id", customerId);
    }
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: {
        code: "customer_create_failed",
        message: error instanceof Error ? error.message : "Customer record could not be created.",
      },
    };
  }

  const leadNotes = buildWebsiteEnquiryNote(cleanPayload, {
    matchedExistingCustomerHistory: matchDecision.matchedExistingCustomerHistory,
  });

  const { data: recentLead } = await admin
    .schema("crm")
    .from("leads")
    .select("id, customer_id, status, submission_count, first_submitted_at, last_submitted_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("intake_source", WEBSITE_INTAKE_SOURCE)
    .eq("submission_fingerprint", submissionFingerprint)
    .in("status", openWebsiteLeadStatuses)
    .order("last_submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dedupeCandidate = recentLead as (ExistingLeadCandidate & { created_at?: string | null; last_submitted_at?: string | null }) | null;
  const dedupeTimestamp = dedupeCandidate?.last_submitted_at ?? dedupeCandidate?.first_submitted_at ?? dedupeCandidate?.created_at ?? null;

  if (dedupeCandidate && isWithinLeadDedupeWindow(submittedAt, dedupeTimestamp)) {
    const nextSubmissionCount = (dedupeCandidate.submission_count ?? 1) + 1;
    const duplicateLeadNotes = buildWebsiteEnquiryNote(cleanPayload, {
      matchedExistingCustomerHistory: matchDecision.matchedExistingCustomerHistory,
      deduped: true,
      submissionCount: nextSubmissionCount,
    });

    const { error: updateLeadError } = await admin
      .schema("crm")
      .from("leads")
      .update({
        customer_id: customerId,
        service_id: serviceId,
        job_type_id: jobTypeId,
        source: cleanPayload.attribution.utm_source || WEBSITE_CUSTOMER_SOURCE,
        notes: duplicateLeadNotes,
        intake_source: WEBSITE_INTAKE_SOURCE,
        submission_fingerprint: submissionFingerprint,
        submission_count: nextSubmissionCount,
        last_submitted_at: submittedAt.toISOString(),
        possible_duplicate_customer_id: matchDecision.possibleDuplicateCustomerId,
        matched_customer_confidence: matchDecision.matchedCustomerConfidence,
        customer_match_result: matchDecision.customerMatchResult,
        dedupe_result: "updated_existing" satisfies LeadDedupeResult,
      })
      .eq("id", dedupeCandidate.id);

    if (updateLeadError) {
      return {
        ok: false,
        status: 500,
        error: {
          code: "lead_update_failed",
          message: updateLeadError.message,
        },
      };
    }

    await admin.schema("crm").from("notes").insert({
      tenant_id: tenantId,
      entity_type: "lead",
      entity_id: dedupeCandidate.id,
      body: duplicateLeadNotes,
    });

    return { ok: true };
  }

  const { data: createdLead, error: leadError } = await admin
    .schema("crm")
    .from("leads")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      service_id: serviceId,
      job_type_id: jobTypeId,
      status: "new",
      source: cleanPayload.attribution.utm_source || WEBSITE_CUSTOMER_SOURCE,
      notes: leadNotes,
      intake_source: WEBSITE_INTAKE_SOURCE,
      submission_fingerprint: submissionFingerprint,
      submission_count: 1,
      first_submitted_at: submittedAt.toISOString(),
      last_submitted_at: submittedAt.toISOString(),
      possible_duplicate_customer_id: matchDecision.possibleDuplicateCustomerId,
      matched_customer_confidence: matchDecision.matchedCustomerConfidence,
      customer_match_result: matchDecision.customerMatchResult,
      dedupe_result: "created" satisfies LeadDedupeResult,
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
      tenant_id: tenantId,
      entity_type: "customer",
      entity_id: customerId,
      body: leadNotes,
    },
    {
      tenant_id: tenantId,
      entity_type: "lead",
      entity_id: createdLead.id,
      body: leadNotes,
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
