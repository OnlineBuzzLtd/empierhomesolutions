import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppointmentStatus, AppointmentType, LeadStatus } from "@/modules/crm/types";
import { syncAppointmentReminder24h } from "@/modules/crm/notifications/appointment-reminders";
import { draftQuoteForJob } from "@/modules/crm/lib/quote-automation";
import type { PlatformCommandEnvelope } from "@/modules/platform/contracts";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";
import {
  buildBookingReviewMetadata,
  detectBookingIdentityConflict,
  type BookingCustomerIdentity,
  type BookingIdentityConflict,
} from "@/modules/platform/lib/booking-identity";
import {
  getPlatformConversationLink,
  type PlatformConversationLink,
  type WorkspaceAlias,
  upsertPlatformConversationLink,
} from "@/modules/platform/lib/repository";

type CustomerMatchRow = {
  id: string;
  tenant_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  postcode: string | null;
  archived: boolean;
};

type JobMatchRow = {
  id: string;
  customer_id: string;
  status: string;
  title: string;
  scheduled_date: string | null;
  created_at: string;
};

export type PlatformJobMatchCandidate = JobMatchRow;

type ServiceMatchRow = {
  id: string;
  tenant_id: string | null;
  slug: string | null;
  name: string;
  active?: boolean | null;
  ai_visible?: boolean | null;
};

type JobTypeMatchRow = {
  id: string;
  tenant_id: string | null;
  service_id: string;
  slug: string | null;
  name: string;
  active?: boolean | null;
  ai_visible?: boolean | null;
};

type BookingClassification = {
  serviceId: string | null;
  serviceName: string | null;
  jobTypeId: string | null;
  jobTypeName: string | null;
  needsReview: boolean;
  reviewReason: string | null;
};

// Extract an is_test flag from a platform event payload. Accepts either
// a top-level `is_test` field or `metadata.is_test`, in any of the common
// true-ish encodings (boolean, "true", "1", 1). The same helper drives
// is_test propagation into crm.customers / crm.leads / crm.jobs (Demo
// Console B-3) and the pre-existing crm.appointments path (CAL-003).
//
// Note: when a payload sets is_test=true we want every row created by
// that event to carry the flag, so cleanup at end-of-demo (E-5) can
// find them all by `tenant_id + is_test=true + created_at >= session_start`.
export function extractIsTestFromPayload(payload: Record<string, unknown>): boolean {
  const top = payload.is_test;
  const meta =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, unknown>).is_test
      : undefined;
  const value = top ?? meta;
  return value === true || value === "true" || value === 1 || value === "1";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function toIsoString(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function isValidTimeZone(value: string | null) {
  if (!value) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveBookingTimeZone(payload: Record<string, unknown>) {
  const candidate = pickString(payload, [
    "timezone",
    "time_zone",
    "booking_timezone",
    "display_timezone",
    "displayTimezone",
  ]);
  return isValidTimeZone(candidate) ? candidate! : "Europe/London";
}

export function bookingInstantToTenantSchedule(iso: string, timeZone = "Europe/London") {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return {
      scheduledDate: iso.slice(0, 10),
      scheduledTime: `${iso.slice(11, 16)}:00`,
    };
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: isValidTimeZone(timeZone) ? timeZone : "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(parsed).map((part) => [part.type, part.value]));
  return {
    scheduledDate: `${parts.year}-${parts.month}-${parts.day}`,
    scheduledTime: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function normalizePhone(value: string | null) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^\d+]/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeEmail(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparableText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeCatalogToken(value: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function collectPayloadStrings(payload: Record<string, unknown>, keys: string[]) {
  const metadata = asRecord(payload.metadata);
  return keys
    .flatMap((key) => {
      const values = [payload[key], metadata[key]];
      return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    })
    .map((value) => value.trim());
}

function formatPhoneForDisplay(phone: string) {
  // Keep this dumb: we just want a stable, human-readable fragment to stick
  // onto "Customer ..." so the row is identifiable on /jobs and /customers
  // until a real name arrives. Preserve a leading "+" for E.164 numbers,
  // otherwise strip punctuation so we don't get "Customer (077) 1234-5678".
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length === 0) {
    return trimmed;
  }
  return hasPlus ? `+${digits}` : digits;
}

function deriveCustomerDisplayName(options: {
  fullName: string | null;
  phone: string | null;
  email: string | null;
}) {
  if (options.fullName) {
    return options.fullName;
  }
  if (options.phone) {
    const formatted = formatPhoneForDisplay(options.phone);
    if (formatted) {
      return `Customer ${formatted}`;
    }
  }
  if (options.email) {
    const local = options.email.split("@")[0]?.trim();
    if (local) {
      return local;
    }
    return options.email;
  }
  return "Unknown customer";
}

function splitNameParts(value: string | null) {
  const fullName = value?.trim().split(/\s+/).filter(Boolean);
  if (!fullName || fullName.length === 0) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  return {
    firstName: fullName[0] ?? null,
    lastName: fullName.length > 1 ? fullName.slice(1).join(" ") : null,
  };
}

function extractDateHint(payload: Record<string, unknown>) {
  const scheduledDate = pickString(payload, ["scheduled_date"]);
  if (scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return scheduledDate;
  }

  const isoDate = pickString(payload, ["booking_start_at", "starts_at"]);
  if (!isoDate) {
    return null;
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function extractJobTitleHints(payload: Record<string, unknown>) {
  return [
    pickString(payload, ["job_title", "title"]),
    pickString(payload, ["serviceCategory", "treatmentType"]),
  ]
    .map((value) => normalizeComparableText(value))
    .filter((value): value is string => value !== null);
}

function scoreJobCandidate(job: PlatformJobMatchCandidate, payload: Record<string, unknown>) {
  let score = 0;
  const dateHint = extractDateHint(payload);
  const normalizedJobTitle = normalizeComparableText(job.title);

  if (dateHint && job.scheduled_date === dateHint) {
    score += 80;
  }

  for (const titleHint of extractJobTitleHints(payload)) {
    if (!normalizedJobTitle) {
      continue;
    }

    if (normalizedJobTitle === titleHint) {
      score += 60;
      continue;
    }

    if (normalizedJobTitle.includes(titleHint) || titleHint.includes(normalizedJobTitle)) {
      score += 35;
    }
  }

  if (["enquiry", "booked", "in_progress"].includes(job.status)) {
    score += 5;
  }

  return score;
}

export function selectLinkableJobForPayload(
  jobs: readonly PlatformJobMatchCandidate[],
  payload: Record<string, unknown>,
) {
  if (jobs.length === 0) {
    return null;
  }

  const explicitJobId = pickString(payload, ["job_id"]);
  if (explicitJobId) {
    return jobs.find((job) => job.id === explicitJobId) ?? null;
  }

  const activeJobs = jobs.filter((job) => ["enquiry", "booked", "in_progress"].includes(job.status));
  const candidates = activeJobs.length > 0 ? activeJobs : jobs;
  const scored = candidates
    .map((job) => ({
      job,
      score: scoreJobCandidate(job, payload),
    }))
    .sort((left, right) => right.score - left.score || right.job.created_at.localeCompare(left.job.created_at));

  const best = scored[0];
  if (!best) {
    return null;
  }

  if (best.score > 0) {
    const runnerUp = scored[1];
    if (!runnerUp || best.score > runnerUp.score) {
      return best.job;
    }

    return null;
  }

  return candidates.length === 1 ? candidates[0] ?? null : null;
}

function buildLeadStatus(payload: Record<string, unknown>): LeadStatus {
  const qualificationStatus = pickString(payload, ["qualification_status"]);
  if (qualificationStatus === "qualified") {
    return "contacted";
  }

  const escalationStatus = pickString(payload, ["escalation_status"]);
  if (escalationStatus === "raised") {
    return "contacted";
  }

  return "new";
}

function buildLeadSource(payload: Record<string, unknown>) {
  const channel = pickString(payload, ["channel", "response_channel", "source_channel"]);
  return channel ? `ai_${channel}` : "ai_platform";
}

function buildLeadSourceEnum(payload: Record<string, unknown>) {
  const channel = pickString(payload, ["channel", "response_channel", "source_channel"]);
  switch (channel) {
    case "webchat":
    case "web_chat":
      return "webchat";
    case "voice":
      return "voice";
    case "sms":
      return "sms";
    case "whatsapp":
      return "whatsapp";
    case "email":
      return "email";
    default:
      return "other";
  }
}

function buildLeadNotes(payload: Record<string, unknown>) {
  const summaryParts = [
    pickString(payload, ["message_summary"]),
    pickString(payload, ["reason"]),
    pickString(payload, ["response_text"]),
  ].filter((value): value is string => value !== null);

  const leadScore = pickNumber(payload, ["lead_score"]);
  const leadBand = pickString(payload, ["lead_band"]);
  if (leadScore !== null || leadBand !== null) {
    summaryParts.push(`Lead score ${leadScore ?? "unknown"}${leadBand ? ` (${leadBand})` : ""}`);
  }

  const bookingSlot = pickString(payload, ["booking_slot_label"]);
  if (bookingSlot) {
    summaryParts.push(`Booked slot ${bookingSlot}`);
  }

  return summaryParts.join("\n");
}

function buildLeadFieldPatch(payload: Record<string, unknown>) {
  return {
    problem_description: pickString(payload, ["problem_description", "issue_description", "message_summary"]),
    affected_area: pickString(payload, ["affected_area"]),
    urgency_level: pickString(payload, ["urgency_level", "urgency"]),
    preferred_date_text: pickString(payload, ["preferred_date_text", "requested_date_text"]),
    preferred_time_window: pickString(payload, ["preferred_time_window", "requested_time_window"]),
  };
}

function buildConversationSessionMetadata(payload: Record<string, unknown>) {
  return {
    session_id: pickString(payload, ["session_id"]),
    prior_session_id: pickString(payload, ["prior_session_id"]),
    restart_reason: pickString(payload, ["restart_reason"]),
    session_origin: pickString(payload, ["session_origin"]),
    returning_customer: payload.returning_customer === true,
    memory_applied: asRecord(payload.memory_applied)
  };
}

function buildCallbackTitle(payload: Record<string, unknown>) {
  const callStatus = pickString(payload, ["call_status"]);
  return callStatus ? `Missed call recovery (${callStatus})` : "Missed call recovery";
}

function buildBookingTitle(payload: Record<string, unknown>) {
  const explicitTitle = pickString(payload, ["booking_title", "job_title", "title"]);
  if (explicitTitle) {
    return explicitTitle;
  }
  const bookingSlot = pickString(payload, ["booking_slot_label"]);
  const treatmentType = pickString(payload, ["treatmentType", "serviceCategory"]);
  if (bookingSlot && treatmentType) {
    return `Booked visit: ${treatmentType} (${bookingSlot})`;
  }
  if (bookingSlot) {
    return `Booked visit: ${bookingSlot}`;
  }
  if (treatmentType) {
    return `Booked visit: ${treatmentType}`;
  }
  return "Booked visit";
}

async function createLead(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  payload: Record<string, unknown>,
) {
  const leadFieldPatch = buildLeadFieldPatch(payload);
  const { data, error } = await supabase
    .schema("crm")
    .from("leads")
    .insert({
      tenant_id: alias.tenant_id,
      status: buildLeadStatus(payload),
      source: buildLeadSource(payload),
      source_enum: buildLeadSourceEnum(payload),
      intake_source: "ai_receptionist",
      lead_attribution: {
        platform_lead_id: pickString(payload, ["lead_id", "platform_lead_id"]),
        platform_booking_id: pickString(payload, ["booking_id", "booking_uid", "calcom_booking_id"]),
        platform_conversation_id: pickString(payload, ["conversation_id"]),
        channel: pickString(payload, ["channel", "response_channel", "source_channel"]),
      },
      notes: buildLeadNotes(payload) || null,
      is_test: extractIsTestFromPayload(payload),
      ...leadFieldPatch,
    })
    .select("*")
    .single<{
      id: string;
      tenant_id: string;
      customer_id: string | null;
      type: string;
      title: string;
      starts_at: string;
      status: string;
      is_test?: boolean | null;
    }>();

  if (error || !data) {
    throw error ?? new Error("Failed to create CRM lead from platform command.");
  }

  await syncAppointmentReminder24h(supabase, alias.tenant_id, data);

  return data.id;
}

async function findCustomerByIdentity(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    phone?: string | null;
    email?: string | null;
  },
) {
  const normalizedPhone = normalizePhone(input.phone ?? null);
  const normalizedEmail = normalizeEmail(input.email ?? null);
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .select("id, tenant_id, full_name, first_name, last_name, phone, email, address_line1, city, postcode, archived")
    .eq("tenant_id", tenantId)
    .eq("archived", false)
    .returns<CustomerMatchRow[]>();

  if (error) {
    throw error;
  }

  const customers = (data ?? []) as CustomerMatchRow[];
  if (normalizedEmail) {
    const emailMatch = customers.find((customer) => normalizeEmail(customer.email) === normalizedEmail);
    if (emailMatch) {
      return emailMatch;
    }
  }

  if (normalizedPhone) {
    const phoneMatch = customers.find((customer) => normalizePhone(customer.phone) === normalizedPhone);
    if (phoneMatch) {
      return phoneMatch;
    }
  }

  return null;
}

async function findCustomerById(supabase: SupabaseClient, tenantId: string, customerId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .select("id, tenant_id, full_name, first_name, last_name, phone, email, address_line1, city, postcode, archived")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .eq("archived", false)
    .maybeSingle<CustomerMatchRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function createCustomerFromPayload(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  payload: Record<string, unknown>,
) {
  // Accept BOTH naming conventions:
  //  - camelCase (`customerName`, `customerPhone`, …) used by the legacy
  //    /api/platform/commands path and the form intake flows
  //  - snake_case (`customer_full_name`, `customer_phone`, …) used by the
  //    CJ runtime BookingConfirmed payload (crm-platform-events.ts)
  // Without the snake_case keys here, voice-booked customers slip through
  // the resolver as "no identity" and never land as customers/jobs.
  const fullName = pickString(payload, ["customerName", "customer_full_name", "full_name"]);
  const firstName = pickString(payload, ["first_name"]);
  const lastName = pickString(payload, ["last_name"]);
  const phone = pickString(payload, ["customerPhone", "customer_phone", "identity_phone", "from"]);
  const email = pickString(payload, ["customerEmail", "customer_email", "identity_email"]);

  // We still require *some* identity (phone, email, or explicit name) to avoid
  // creating empty shell records, but we no longer insist on a captured name.
  // WhatsApp / SMS bookings routinely confirm before the bot has asked for a
  // name and we'd rather have a placeholder row we can upgrade later than lose
  // the Job entirely. updateCustomerFromPayload patches full_name once a real
  // name shows up on a subsequent event.
  if (!fullName && !phone && !email) {
    return null;
  }

  const displayName = deriveCustomerDisplayName({ fullName, phone, email });
  const parsedParts = splitNameParts(fullName ?? displayName);

  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .insert({
      tenant_id: alias.tenant_id,
      full_name: displayName,
      first_name: firstName ?? parsedParts.firstName,
      last_name: lastName ?? parsedParts.lastName,
      phone,
      email,
      address_line1: pickString(payload, ["serviceAddressLine1", "service_address_line1", "address_line1", "customer_address"]),
      city: pickString(payload, ["serviceCity", "service_city", "city"]),
      postcode: pickString(payload, ["servicePostcode", "customer_postcode", "postcode"]),
      source: buildLeadSource(payload),
      source_enum: buildLeadSourceEnum(payload),
      notes: buildLeadNotes(payload) || null,
      archived: false,
      is_test: extractIsTestFromPayload(payload),
    })
    .select("id, tenant_id, full_name, first_name, last_name, phone, email, address_line1, city, postcode, archived")
    .single<CustomerMatchRow>();

  if (error || !data) {
    throw error ?? new Error("Failed to create CRM customer from platform payload.");
  }

  return data;
}

async function updateCustomerFromPayload(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  customer: CustomerMatchRow,
  payload: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {};
  // Same dual-convention support as createCustomerFromPayload above —
  // CJ's BookingConfirmed sends snake_case, legacy intakes send camelCase.
  const nextName = pickString(payload, ["customerName", "customer_full_name", "full_name"]);
  const nextFirstName = pickString(payload, ["first_name"]);
  const nextLastName = pickString(payload, ["last_name"]);
  const nextPhone = pickString(payload, ["customerPhone", "customer_phone", "identity_phone", "from"]);
  const nextEmail = pickString(payload, ["customerEmail", "customer_email", "identity_email"]);
  const nextAddressLine1 = pickString(payload, ["serviceAddressLine1", "service_address_line1", "address_line1", "customer_address"]);
  const nextCity = pickString(payload, ["serviceCity", "service_city", "city"]);
  const nextPostcode = pickString(payload, ["servicePostcode", "customer_postcode", "postcode"]);

  // Merge policy: latest non-empty payload value wins. Previously this only
  // patched NULL fields, which caused real-call confusion — a return caller
  // who gave a different name (or a corrected email/address) had their
  // original record kept verbatim because those fields weren't NULL. The
  // booking-confirmed payload is authoritative for what the agent collected
  // on this specific call. Empty / null payload values still skip, so we
  // never blank out an existing field; we only overwrite when a fresh value
  // is present.
  //
  // ConversationStarted (voice) carries no identity name/email/address, so
  // those paths remain no-ops. ConversationStarted (webchat) carries
  // `customer_full_name` from the chat opener — that user-stated value
  // taking effect matches the same "latest stated name wins" behavior.
  if (nextName) {
    patch.full_name = nextName;
    const parts = splitNameParts(nextName);
    if (nextFirstName || parts.firstName) patch.first_name = nextFirstName ?? parts.firstName;
    if (nextLastName || parts.lastName) patch.last_name = nextLastName ?? parts.lastName;
  } else {
    if (nextFirstName) patch.first_name = nextFirstName;
    if (nextLastName) patch.last_name = nextLastName;
  }
  if (nextPhone) {
    patch.phone = nextPhone;
  }
  if (nextEmail) {
    patch.email = nextEmail;
  }
  if (nextAddressLine1) {
    patch.address_line1 = nextAddressLine1;
  }
  if (nextCity) {
    patch.city = nextCity;
  }
  if (nextPostcode) {
    patch.postcode = nextPostcode;
  }

  if (Object.keys(patch).length === 0) {
    return customer;
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .update({
      ...patch,
      tenant_id: alias.tenant_id,
    })
    .eq("id", customer.id)
    .eq("tenant_id", alias.tenant_id)
    .select("id, tenant_id, full_name, first_name, last_name, phone, email, address_line1, city, postcode, archived")
    .single<CustomerMatchRow>();

  if (error || !data) {
    throw error ?? new Error("Failed to update CRM customer from platform payload.");
  }

  return data;
}

async function resolveCustomerForPayload(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  payload: Record<string, unknown>,
) {
  const explicitCustomerId = pickString(payload, ["customer_id"]);
  if (explicitCustomerId) {
    const explicitCustomer = await findCustomerById(supabase, alias.tenant_id, explicitCustomerId);
    if (explicitCustomer) {
      return updateCustomerFromPayload(supabase, alias, explicitCustomer, payload);
    }
  }

  const existing = await findCustomerByIdentity(supabase, alias.tenant_id, {
    phone: pickString(payload, ["customerPhone", "customer_phone", "identity_phone", "from"]),
    email: pickString(payload, ["customerEmail", "customer_email", "identity_email"]),
  });

  if (existing) {
    return updateCustomerFromPayload(supabase, alias, existing, payload);
  }

  return createCustomerFromPayload(supabase, alias, payload);
}

async function attachLeadToCustomer(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  leadId: string,
  customerId: string,
) {
  const { error } = await supabase
    .schema("crm")
    .from("leads")
    .update({
      tenant_id: alias.tenant_id,
      customer_id: customerId,
    })
    .eq("id", leadId)
    .eq("tenant_id", alias.tenant_id);

  if (error) {
    throw error;
  }
}

async function attachAppointmentToCustomer(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  appointmentId: string,
  customerId: string,
) {
  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({
      tenant_id: alias.tenant_id,
      customer_id: customerId,
    })
    .eq("id", appointmentId)
    .eq("tenant_id", alias.tenant_id);

  if (error) {
    throw error;
  }
}

async function findLinkableJobForCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .select("id, customer_id, status, title, scheduled_date, created_at")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("scheduled_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<JobMatchRow[]>();

  if (error) {
    throw error;
  }

  return selectLinkableJobForPayload((data ?? []) as JobMatchRow[], payload);
}

async function findJobById(supabase: SupabaseClient, tenantId: string, jobId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .select("id, customer_id, status, title, scheduled_date, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle<JobMatchRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function attachAppointmentToJob(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  appointmentId: string,
  jobId: string,
) {
  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({
      tenant_id: alias.tenant_id,
      job_id: jobId,
    })
    .eq("id", appointmentId)
    .eq("tenant_id", alias.tenant_id);

  if (error) {
    throw error;
  }
}

async function listActiveServices(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("services")
    .select("id, tenant_id, slug, name, active, ai_visible")
    .eq("tenant_id", tenantId)
    .returns<ServiceMatchRow[]>();

  if (error) {
    throw error;
  }

  return ((data ?? []) as ServiceMatchRow[]).filter((service) => service.active !== false && service.ai_visible !== false);
}

async function listActiveJobTypes(supabase: SupabaseClient, tenantId: string, serviceId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("job_types")
    .select("id, tenant_id, service_id, slug, name, active, ai_visible")
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId)
    .returns<JobTypeMatchRow[]>();

  if (error) {
    throw error;
  }

  return ((data ?? []) as JobTypeMatchRow[]).filter((jobType) => jobType.active !== false && jobType.ai_visible !== false);
}

function resolveServiceFromPayload(services: ServiceMatchRow[], payload: Record<string, unknown>) {
  const explicitServiceId = pickString(payload, ["service_id"]);
  if (explicitServiceId) {
    const match = services.find((service) => service.id === explicitServiceId);
    if (match) return match;
  }

  const serviceHints = collectPayloadStrings(payload, [
    "service_key",
    "service_slug",
    "service_name",
    "serviceCategory",
    "treatmentType",
    "booking_title",
    "job_title",
    "title",
  ]);
  const hintTokens = serviceHints.map((hint) => normalizeCatalogToken(hint)).filter((hint): hint is string => hint !== null);
  const hintNames = serviceHints.map((hint) => normalizeComparableText(hint)).filter((hint): hint is string => hint !== null);

  const tokenMatch = services.find((service) => {
    const serviceTokens = [normalizeCatalogToken(service.slug), normalizeCatalogToken(service.name)].filter(
      (value): value is string => value !== null,
    );
    return serviceTokens.some((token) => hintTokens.includes(token));
  });
  if (tokenMatch) return tokenMatch;

  return (
    services.find((service) => {
      const serviceName = normalizeComparableText(service.name);
      if (!serviceName) {
        return false;
      }
      if (hintNames.includes(serviceName)) {
        return true;
      }
      const serviceStem = serviceName.endsWith("s") ? serviceName.slice(0, -1) : serviceName;
      return serviceStem.length >= 4 && hintNames.some((hint) => hint.includes(serviceStem));
    }) ?? null
  );
}

function resolveJobTypeFromPayload(jobTypes: JobTypeMatchRow[], payload: Record<string, unknown>) {
  const explicitJobTypeId = pickString(payload, ["job_type_id"]);
  if (explicitJobTypeId) {
    const match = jobTypes.find((jobType) => jobType.id === explicitJobTypeId);
    if (match) return match;
  }

  const jobTypeHints = collectPayloadStrings(payload, [
    "job_type_key",
    "job_type_slug",
    "job_type_name",
    "issue_description",
    "problem_description",
    "message_summary",
    "booking_title",
    "job_title",
    "title",
    "service_name",
    "serviceCategory",
    "treatmentType",
  ]);
  const hintTokens = jobTypeHints.map((hint) => normalizeCatalogToken(hint)).filter((hint): hint is string => hint !== null);
  const hintText = jobTypeHints.map((hint) => normalizeComparableText(hint)).filter(Boolean).join(" ");

  const exactMatches = jobTypes.filter((jobType) => {
    const tokens = [normalizeCatalogToken(jobType.slug), normalizeCatalogToken(jobType.name)].filter(
      (value): value is string => value !== null,
    );
    const name = normalizeComparableText(jobType.name);
    return tokens.some((token) => hintTokens.includes(token)) || Boolean(name && hintText.includes(name));
  });
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const keywordGroups = [
    { tokens: ["service", "servicing", "check", "annual service"], labels: ["service"] },
    { tokens: ["repair", "fix", "fault", "not working", "no heating", "no hot water"], labels: ["repair", "fault"] },
    { tokens: ["install", "installation", "replace", "replacement", "new boiler"], labels: ["install", "installation"] },
  ];

  const scored = jobTypes
    .map((jobType) => {
      const normalizedName = normalizeComparableText(jobType.name) ?? "";
      let score = 0;
      for (const group of keywordGroups) {
        const hasPayloadKeyword = group.tokens.some((token) => hintText.includes(token));
        const hasJobTypeLabel = group.labels.some((label) => normalizedName.includes(label));
        if (hasPayloadKeyword && hasJobTypeLabel) {
          score += 10;
        }
      }
      return { jobType, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 1 || (scored[0] && scored[1] && scored[0].score > scored[1].score)) {
    return scored[0]?.jobType ?? null;
  }

  return null;
}

async function resolveBookingClassification(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  payload: Record<string, unknown>,
): Promise<BookingClassification> {
  const services = await listActiveServices(supabase, alias.tenant_id);
  const service = resolveServiceFromPayload(services, payload);
  if (!service) {
    return {
      serviceId: null,
      serviceName: null,
      jobTypeId: null,
      jobTypeName: null,
      needsReview: true,
      reviewReason: "Service could not be matched from the AI booking.",
    };
  }

  const jobTypes = await listActiveJobTypes(supabase, alias.tenant_id, service.id);
  const jobType = resolveJobTypeFromPayload(jobTypes, payload);
  const needsJobTypeReview = jobTypes.length > 0 && !jobType;
  return {
    serviceId: service.id,
    serviceName: service.name,
    jobTypeId: jobType?.id ?? null,
    jobTypeName: jobType?.name ?? null,
    needsReview: needsJobTypeReview,
    reviewReason: needsJobTypeReview ? "Job type needs review before the office relies on this booking." : null,
  };
}

function buildClassificationReviewMetadata(classification: BookingClassification) {
  return {
    needs_review: classification.needsReview,
    review_reason: classification.reviewReason,
    service_id_candidate: classification.serviceId,
    service_name_candidate: classification.serviceName,
    job_type_id_candidate: classification.jobTypeId,
    job_type_name_candidate: classification.jobTypeName,
  };
}

function inferVisitClassification(classification: BookingClassification): "standard" | "survey_assessment" {
  const haystack = [classification.serviceName, classification.jobTypeName]
    .map((value) => normalizeComparableText(value))
    .filter(Boolean)
    .join(" ");

  if (
    /\binstall(ation)?\b/.test(haystack) ||
    /\breplacement\b/.test(haystack) ||
    /\bpower\s*flush\b/.test(haystack) ||
    /\bpowerflush\b/.test(haystack)
  ) {
    return "survey_assessment";
  }

  return "standard";
}

function appointmentTypeForBookingClassification(classification: BookingClassification): AppointmentType {
  return inferVisitClassification(classification) === "survey_assessment" ? "survey" : "booking";
}

async function findJobClassification(supabase: SupabaseClient, tenantId: string, jobId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .select("id, service_id, job_type_id")
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle<{ id: string; service_id: string | null; job_type_id: string | null }>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function syncJobScheduleFromBooking(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  input: {
    jobId: string;
    title: string;
    description: string | null;
    startsAt: string;
    timeZone: string;
    assignedEngineer: string | null;
    classification: BookingClassification;
  },
): Promise<string | null> {
  const { scheduledDate, scheduledTime } = bookingInstantToTenantSchedule(input.startsAt, input.timeZone);

  const updatePayload: Record<string, unknown> = {
    title: input.title,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    status: "booked",
    visit_classification: inferVisitClassification(input.classification),
    commercial_stage: inferVisitClassification(input.classification) === "survey_assessment" ? "survey_booked" : "booked",
  };
  if (input.description) {
    updatePayload.description = input.description;
  }
  if (input.assignedEngineer) {
    updatePayload.assigned_engineer = input.assignedEngineer;
  }

  const existing = await findJobClassification(supabase, alias.tenant_id, input.jobId);
  let reviewReason: string | null = null;
  if (input.classification.serviceId) {
    if (!existing?.service_id) {
      updatePayload.service_id = input.classification.serviceId;
    } else if (existing.service_id !== input.classification.serviceId) {
      reviewReason = "Existing job service differs from the AI booking service.";
    }
  }
  if (input.classification.jobTypeId) {
    if (!existing?.job_type_id) {
      updatePayload.job_type_id = input.classification.jobTypeId;
    } else if (existing.job_type_id !== input.classification.jobTypeId) {
      reviewReason = "Existing job type differs from the AI booking job type.";
    }
  }

  const { error } = await supabase
    .schema("crm")
    .from("jobs")
    .update(updatePayload)
    .eq("id", input.jobId)
    .eq("tenant_id", alias.tenant_id);

  if (error) {
    throw error;
  }

  return reviewReason;
}

async function createJobFromBooking(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  input: {
    customerId: string;
    leadId: string | null;
    title: string;
    description: string | null;
    startsAt: string;
    timeZone: string;
    assignedEngineer: string | null;
    classification: BookingClassification;
    isTest?: boolean;
  },
): Promise<string> {
  const { scheduledDate, scheduledTime } = bookingInstantToTenantSchedule(input.startsAt, input.timeZone);

  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .insert({
      tenant_id: alias.tenant_id,
      customer_id: input.customerId,
      lead_id: input.leadId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: "booked",
      visit_classification: inferVisitClassification(input.classification),
      commercial_stage: inferVisitClassification(input.classification) === "survey_assessment" ? "survey_booked" : "booked",
      service_id: input.classification.serviceId,
      job_type_id: input.classification.jobTypeId,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      assigned_engineer: input.assignedEngineer ?? null,
      is_demo: false,
      is_test: input.isTest ?? false,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw error ?? new Error("Failed to create job from booking.");
  }

  return data.id;
}

async function createNote(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  input: {
    entityType: "lead" | "customer" | "job";
    entityId: string;
    body: string;
  },
) {
  const { error } = await supabase.schema("crm").from("notes").insert({
    tenant_id: alias.tenant_id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    body: input.body,
    created_by: null,
  });

  if (error) {
    throw error;
  }
}

async function createAppointment(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  input: {
    link: PlatformConversationLink | null;
    type: AppointmentType;
    title: string;
    startsAt: string;
    endsAt: string;
    status?: AppointmentStatus;
    confirmationEmailSentAt?: string | null;
    confirmationSmsSentAt?: string | null;
    notificationStatus?: string | null;
    notificationFailureReason?: string | null;
    postcodeStatus?: string | null;
    visitClassification?: "standard" | "survey_assessment";
    source?: string | null;
    externalId?: string | null;
  },
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .insert({
      tenant_id: alias.tenant_id,
      customer_id: input.link?.customer_id ?? null,
      lead_id: input.link?.lead_id ?? null,
      job_id: input.link?.job_id ?? null,
      assigned_to: null,
      type: input.type,
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      status: input.status ?? "scheduled",
      visit_classification: input.visitClassification ?? "standard",
      confirmation_email_sent_at: input.confirmationEmailSentAt ?? null,
      confirmation_sms_sent_at: input.confirmationSmsSentAt ?? null,
      notification_status: input.notificationStatus ?? null,
      notification_failure_reason: input.notificationFailureReason ?? null,
      postcode_status: input.postcodeStatus ?? null,
      source: input.source ?? "crm",
      external_id: input.externalId ?? null,
      reminder_offset_minutes: null,
      recurrence_rule: null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw error ?? new Error("Failed to create CRM appointment from platform command.");
  }

  return data.id;
}

async function updateAppointmentLeadReference(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  appointmentId: string,
  leadId: string,
) {
  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({
      tenant_id: alias.tenant_id,
      lead_id: leadId,
    })
    .eq("id", appointmentId)
    .eq("tenant_id", alias.tenant_id);

  if (error) {
    throw error;
  }
}

async function updateBookingAppointment(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  input: {
    appointmentId: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: AppointmentStatus;
    customerId?: string | null;
    leadId?: string | null;
    jobId?: string | null;
    postcodeStatus?: string | null;
    visitClassification?: "standard" | "survey_assessment";
    appointmentType?: AppointmentType;
    isTest?: boolean;
  },
) {
  const patch: Record<string, unknown> = {
    tenant_id: alias.tenant_id,
    title: input.title,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status: input.status,
  };
  if (input.visitClassification) {
    patch.visit_classification = input.visitClassification;
  }
  if (input.appointmentType) {
    patch.type = input.appointmentType;
  }
  if (input.customerId) {
    patch.customer_id = input.customerId;
  }
  if (input.leadId) {
    patch.lead_id = input.leadId;
  }
  if (input.jobId) {
    patch.job_id = input.jobId;
  }
  if (input.postcodeStatus) {
    patch.postcode_status = input.postcodeStatus;
  }
  if (input.isTest) {
    patch.is_test = true;
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .update(patch)
    .eq("id", input.appointmentId)
    .eq("tenant_id", alias.tenant_id)
    .select("*")
    .single<{
      id: string;
      tenant_id: string;
      customer_id: string | null;
      type: string;
      title: string;
      starts_at: string;
      status: string;
      is_test?: boolean | null;
    }>();

  if (error) {
    throw error;
  }
  if (data) {
    await syncAppointmentReminder24h(supabase, alias.tenant_id, data);
  }
}

async function updateLeadStatus(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  leadId: string,
  status: LeadStatus,
  notes: string | null,
  payload?: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {
    status,
    ...(payload ? buildLeadFieldPatch(payload) : {}),
  };

  if (notes && notes.length > 0) {
    patch.notes = notes;
  }

  const { error } = await supabase
    .schema("crm")
    .from("leads")
    .update({
      ...patch,
      tenant_id: alias.tenant_id,
    })
    .eq("id", leadId)
    .eq("tenant_id", alias.tenant_id);

  if (error) {
    throw error;
  }
}

type PlatformBookingPayload = {
  bookingId: string | null;
  title: string | null;
  startAt: string;
  endAt: string;
  status: string | null;
  action: string | null;
  resourceId: string | null;
  resourceName: string | null;
  serviceName: string | null;
  conversationId: string | null;
  customer: {
    name: string | null;
    phone: string | null;
    email: string | null;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
  };
  metadata: Record<string, unknown> | null;
  // CAL-003: when the platform-api emits a BookingConfirmed event for a
  // mock-adapter validation run (MESSAGING_ADAPTER=mock), it sets this
  // flag in the event payload. The CRM stores it on
  // crm.appointments.is_test so the check-availability route excludes
  // these rows from conflict detection. Real customer bookings always
  // arrive with is_test = false (the default).
  isTest: boolean;
};

function extractPlatformBookingPayload(payload: Record<string, unknown>, fallbackStart: string): PlatformBookingPayload {
  const customer = asRecord(payload.customer);
  const start = toIsoString(pickString(payload, ["start_at", "booking_start_at", "starts_at"]), fallbackStart);
  const end = toIsoString(pickString(payload, ["end_at", "booking_end_at", "ends_at"]), addMinutes(start, 60));
  return {
    bookingId: pickString(payload, ["booking_id", "booking_uid"]),
    title: pickString(payload, ["booking_title", "job_title", "title"]),
    startAt: start,
    endAt: end,
    status: pickString(payload, ["status", "booking_status"]),
    action: pickString(payload, ["booking_action"]),
    resourceId: pickString(payload, ["resource_id", "booking_resource_id"]),
    resourceName: pickString(payload, ["resource_name", "booking_resource_name"]),
    serviceName: pickString(payload, ["service_name", "service_key", "serviceCategory"]),
    conversationId: pickString(payload, ["conversation_id"]),
    customer: {
      name: pickString(customer, ["name", "full_name"]) ?? pickString(payload, ["customerName", "customer_full_name"]),
      phone: pickString(customer, ["phone"]) ?? pickString(payload, ["customerPhone", "customer_phone", "identity_phone"]),
      email: pickString(customer, ["email"]) ?? pickString(payload, ["customerEmail", "customer_email", "identity_email"]),
      addressLine1: pickString(customer, ["address_line1"]) ?? pickString(payload, ["serviceAddressLine1", "service_address_line1", "customer_address", "address_line1"]),
      city: pickString(customer, ["city"]) ?? pickString(payload, ["serviceCity", "service_city", "city"]),
      postcode: pickString(customer, ["postcode"]) ?? pickString(payload, ["servicePostcode", "customer_postcode", "postcode"]),
    },
    metadata: (() => {
      const raw = asRecord(payload.metadata);
      return Object.keys(raw).length > 0 ? raw : null;
    })(),
    isTest: extractIsTestFromPayload(payload),
  };
}

function mapPlatformBookingStatus(status: string | null, action: string | null): AppointmentStatus {
  // platform-api booking statuses: pending_hold, hold, confirmed, cancelled,
  // rescheduled. CRM appointment statuses: scheduled | completed | cancelled.
  const normalized = (status ?? action ?? "").toLowerCase();
  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }
  if (normalized === "completed" || normalized === "fulfilled") {
    return "completed";
  }
  return "scheduled";
}

function buildPlatformBookingTitle(booking: PlatformBookingPayload): string {
  if (booking.title) {
    return booking.title;
  }
  const prefix = booking.action === "held" ? "Hold" : "Booked visit";
  if (booking.serviceName && booking.resourceName) {
    return `${prefix}: ${booking.serviceName} (${booking.resourceName})`;
  }
  if (booking.serviceName) {
    return `${prefix}: ${booking.serviceName}`;
  }
  if (booking.resourceName) {
    return `${prefix}: ${booking.resourceName}`;
  }
  return prefix;
}

async function findAppointmentByExternalId(
  supabase: SupabaseClient,
  tenantId: string,
  externalId: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id, customer_id, lead_id, job_id, status")
    .eq("tenant_id", tenantId)
    .eq("source", "platform")
    .eq("external_id", externalId)
    .maybeSingle<{ id: string; customer_id: string | null; lead_id: string | null; job_id: string | null; status: AppointmentStatus }>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function resolveCustomerForPlatformBooking(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  booking: PlatformBookingPayload,
) {
  const flat: Record<string, unknown> = {
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    customerEmail: booking.customer.email,
    serviceAddressLine1: booking.customer.addressLine1,
    serviceCity: booking.customer.city,
    servicePostcode: booking.customer.postcode,
  };

  const existing = await findCustomerByIdentity(supabase, alias.tenant_id, {
    phone: booking.customer.phone,
    email: booking.customer.email,
  });

  if (existing) {
    const conflict = detectBookingIdentityConflict(existing, booking.customer);
    if (conflict) {
      return null;
    }
    return updateCustomerFromPayload(supabase, alias, existing, flat);
  }

  return createCustomerFromPayload(supabase, alias, flat);
}

type BookingCustomerResolution =
  | { status: "resolved"; customer: CustomerMatchRow | null }
  | { status: "conflict"; conflict: BookingIdentityConflict };

function buildBookingCustomerIdentityFromPayload(payload: Record<string, unknown>): BookingCustomerIdentity {
  return {
    name: pickString(payload, ["customerName", "customer_full_name", "full_name"]),
    phone: pickString(payload, ["customerPhone", "customer_phone", "identity_phone", "from"]),
    email: pickString(payload, ["customerEmail", "customer_email", "identity_email"]),
    addressLine1: pickString(payload, ["serviceAddressLine1", "service_address_line1", "address_line1", "customer_address"]),
    city: pickString(payload, ["serviceCity", "service_city", "city"]),
    postcode: pickString(payload, ["servicePostcode", "customer_postcode", "postcode"]),
  };
}

function bookingCustomerIdentityToPayload(customer: BookingCustomerIdentity): Record<string, unknown> {
  return {
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    serviceAddressLine1: customer.addressLine1,
    serviceCity: customer.city,
    servicePostcode: customer.postcode,
  };
}

async function resolveCustomerForBookingPayload(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  payload: Record<string, unknown>,
): Promise<BookingCustomerResolution> {
  const identityMode = pickString(payload, ["identity_resolution"]);
  const bookingCustomer = buildBookingCustomerIdentityFromPayload(payload);
  const flat = bookingCustomerIdentityToPayload(bookingCustomer);

  if (identityMode === "force_new_customer") {
    return { status: "resolved", customer: await createCustomerFromPayload(supabase, alias, flat) };
  }

  const explicitCustomerId = pickString(payload, ["recovery_customer_id"]);
  if (identityMode === "link_customer" && explicitCustomerId) {
    const explicitCustomer = await findCustomerById(supabase, alias.tenant_id, explicitCustomerId);
    return {
      status: "resolved",
      customer: explicitCustomer ? await updateCustomerFromPayload(supabase, alias, explicitCustomer, flat) : null,
    };
  }

  const existing = await findCustomerByIdentity(supabase, alias.tenant_id, {
    phone: bookingCustomer.phone,
    email: bookingCustomer.email,
  });

  if (existing) {
    const conflict = detectBookingIdentityConflict(existing, bookingCustomer);
    if (conflict) {
      return { status: "conflict", conflict };
    }
    return { status: "resolved", customer: await updateCustomerFromPayload(supabase, alias, existing, flat) };
  }

  return { status: "resolved", customer: await createCustomerFromPayload(supabase, alias, flat) };
}

async function upsertAppointmentFromPlatformBooking(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  command: PlatformCommandEnvelope,
) {
  const payload = asRecord(command.payload);
  const booking = extractPlatformBookingPayload(payload, command.issued_at);
  if (!booking.bookingId) {
    // Platform events are signed and validated; this really shouldn't happen,
    // but if it does we'd rather swallow silently than poison the outbox.
    return;
  }

  const customer = await resolveCustomerForPlatformBooking(supabase, alias, booking);
  const customerId = customer?.id ?? null;
  const title = buildPlatformBookingTitle(booking);
  const appointmentStatus = mapPlatformBookingStatus(booking.status, booking.action);
  const existing = await findAppointmentByExternalId(supabase, alias.tenant_id, booking.bookingId);

  if (existing) {
    const patch: Record<string, unknown> = {
      tenant_id: alias.tenant_id,
      title,
      starts_at: booking.startAt,
      ends_at: booking.endAt,
      status: appointmentStatus,
    };
    if (customerId && !existing.customer_id) {
      patch.customer_id = customerId;
    }
    // CAL-003: once flagged as test, stay flagged (never un-flag on update).
    // Update only flips to true if the latest event payload says so.
    if (booking.isTest) {
      patch.is_test = true;
    }
    const { error } = await supabase
      .schema("crm")
      .from("appointments")
      .update(patch)
      .eq("id", existing.id)
      .eq("tenant_id", alias.tenant_id);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .insert({
      tenant_id: alias.tenant_id,
      customer_id: customerId,
      lead_id: null,
      job_id: null,
      assigned_to: null,
      type: "booking" satisfies AppointmentType,
      title,
      starts_at: booking.startAt,
      ends_at: booking.endAt,
      status: appointmentStatus,
      reminder_offset_minutes: null,
      recurrence_rule: null,
      source: "platform",
      external_id: booking.bookingId,
      is_test: booking.isTest,
    });

  if (error) {
    throw error;
  }
}

async function cancelAppointmentFromPlatformBooking(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  command: PlatformCommandEnvelope,
) {
  const payload = asRecord(command.payload);
  const bookingId = pickString(payload, ["booking_id", "booking_uid"]);
  if (!bookingId) {
    return;
  }

  const existing = await findAppointmentByExternalId(supabase, alias.tenant_id, bookingId);
  if (!existing) {
    // Cancel-before-create is legal — we just mark the booking as cancelled
    // on next upsert. Ignore.
    return;
  }

  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({
      tenant_id: alias.tenant_id,
      status: "cancelled" satisfies AppointmentStatus,
    })
    .eq("id", existing.id)
    .eq("tenant_id", alias.tenant_id);

  if (error) {
    throw error;
  }
}

async function upsertLeadFromPlatform(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  command: PlatformCommandEnvelope,
) {
  const payload = asRecord(command.payload);
  const customer = asRecord(payload.customer);

  const flat: Record<string, unknown> = {
    customerName: pickString(customer, ["name"]) ?? pickString(payload, ["customerName"]),
    customerPhone: pickString(customer, ["phone"]) ?? pickString(payload, ["customerPhone", "identity_phone"]),
    customerEmail: pickString(customer, ["email"]) ?? pickString(payload, ["customerEmail", "identity_email"]),
    serviceAddressLine1: pickString(customer, ["address_line1"]) ?? pickString(payload, ["serviceAddressLine1"]),
    serviceCity: pickString(customer, ["city"]) ?? pickString(payload, ["serviceCity"]),
    servicePostcode: pickString(customer, ["postcode"]) ?? pickString(payload, ["servicePostcode"]),
    urgency_level: pickString(payload, ["urgency"]),
    problem_description: pickString(payload, ["notes", "issue_description", "message_summary"]),
    serviceCategory: pickString(payload, ["service_name", "service_key"]),
  };

  const customerRow = await findCustomerByIdentity(supabase, alias.tenant_id, {
    phone: String(flat.customerPhone ?? "") || null,
    email: String(flat.customerEmail ?? "") || null,
  });

  const resolvedCustomer = customerRow
    ? await updateCustomerFromPayload(supabase, alias, customerRow, flat)
    : await createCustomerFromPayload(supabase, alias, flat);

  const source = pickString(payload, ["source"]) ?? "voice";
  const notes = pickString(payload, ["notes", "message_summary"]);

  const { error } = await supabase
    .schema("crm")
    .from("leads")
    .insert({
      tenant_id: alias.tenant_id,
      customer_id: resolvedCustomer?.id ?? null,
      status: "new" satisfies LeadStatus,
      source: `platform_${source}`,
      notes,
      intake_source: "platform_api",
      problem_description: String(flat.problem_description ?? "") || null,
      urgency_level: String(flat.urgency_level ?? "") || null,
      is_test: extractIsTestFromPayload(payload),
    });

  if (error) {
    // Don't block the outbox on a unique-index race; platform emits lead.upserted
    // repeatedly and duplicates can legitimately occur until we add a
    // (tenant_id, external_id) index on leads too. Swallow PostgreSQL unique
    // violations, rethrow everything else.
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      return;
    }
    throw error;
  }
}

async function recordResourceAvailabilityChange(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  command: PlatformCommandEnvelope,
) {
  // resource.availability_changed is informational for the CRM: the platform-api
  // remains the authoritative source for working hours and time-off. We log it
  // into the generic platform events table (via recordPlatformEvent upstream)
  // and, for now, take no further action. This handler exists so the command
  // router doesn't warn about unhandled command_types and so we have a
  // well-named hook to plug in cache invalidation later.
  void supabase;
  void alias;
  void command;
}

function resolveConversationId(command: PlatformCommandEnvelope) {
  if (command.aggregate.type === "conversation" && command.aggregate.id) {
    return command.aggregate.id;
  }

  return command.correlation_id ?? null;
}

async function ensureLeadForConversation(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  conversationId: string,
  payload: Record<string, unknown>,
) {
  const link = await getPlatformConversationLink(supabase, alias.tenant_id, conversationId);
  if (link?.lead_id) {
    return link;
  }

  const leadId = await createLead(supabase, alias, payload);
  return upsertPlatformConversationLink(supabase, alias, {
    conversationId,
    leadId,
    latestChannel: pickString(payload, ["channel", "response_channel"]) ?? link?.latest_channel ?? null,
    identityPhone: pickString(payload, ["identity_phone", "customerPhone"]) ?? link?.identity_phone ?? null,
    identityEmail: pickString(payload, ["identity_email", "customerEmail"]) ?? link?.identity_email ?? null,
    metadata: {
      latest_reason: pickString(payload, ["reason"]),
      ...buildConversationSessionMetadata(payload),
    },
    latestEventAt: pickString(payload, ["occurred_at"]) ?? null,
  });
}

async function ensureBookingLeadForConversation(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  conversationId: string,
  payload: Record<string, unknown>,
) {
  const link = await getPlatformConversationLink(supabase, alias.tenant_id, conversationId);
  const metadata = asRecord(link?.metadata);
  const incomingPlatformLeadId = pickString(payload, ["lead_id", "platform_lead_id"]);
  const linkedPlatformLeadId = pickString(metadata, ["platform_lead_id"]);
  const incomingBookingId = pickString(payload, ["booking_id", "booking_uid", "calcom_booking_id"]);
  const linkedBookingId = pickString(metadata, ["platform_booking_id", "booking_id", "booking_uid", "calcom_booking_id"]);
  const hasDifferentExternalLead =
    Boolean(incomingPlatformLeadId && linkedPlatformLeadId && incomingPlatformLeadId !== linkedPlatformLeadId);
  const hasDifferentBooking = Boolean(incomingBookingId && linkedBookingId && incomingBookingId !== linkedBookingId);
  const oldLinkHasUnattributedBooking =
    Boolean(incomingPlatformLeadId && !linkedPlatformLeadId && link?.booking_appointment_id);

  if (link?.lead_id && !hasDifferentExternalLead && !hasDifferentBooking && !oldLinkHasUnattributedBooking) {
    return link;
  }

  const leadId = await createLead(supabase, alias, {
    ...payload,
    conversation_id: conversationId,
  });
  return upsertPlatformConversationLink(supabase, alias, {
    conversationId,
    leadId,
    clearCustomerId: hasDifferentBooking || oldLinkHasUnattributedBooking,
    clearJobId: hasDifferentBooking || oldLinkHasUnattributedBooking,
    clearBookingAppointmentId: hasDifferentBooking || oldLinkHasUnattributedBooking,
    latestChannel: pickString(payload, ["channel", "response_channel"]) ?? link?.latest_channel ?? null,
    identityPhone: pickString(payload, ["identity_phone", "customer_phone", "customerPhone", "from"]) ?? link?.identity_phone ?? null,
    identityEmail: pickString(payload, ["identity_email", "customer_email", "customerEmail"]) ?? link?.identity_email ?? null,
    metadata: {
      latest_reason: pickString(payload, ["reason"]),
      platform_lead_id: incomingPlatformLeadId,
      platform_booking_id: incomingBookingId,
      needs_review: false,
      review_reason: null,
      ...buildConversationSessionMetadata(payload),
    },
    latestEventAt: pickString(payload, ["occurred_at", "booking_start_at", "starts_at"]) ?? null,
  });
}

export async function executePlatformCommand(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  command: PlatformCommandEnvelope,
) {
  const payload = asRecord(command.payload);
  const conversationId = resolveConversationId(command);
  const occurredAt = toIsoString(pickString(payload, ["occurred_at", "starts_at", "booking_start_at"]), command.issued_at);

  switch (command.command_type) {
    case "MatchCustomerByChannelIdentity": {
      if (!conversationId) {
        return;
      }

      const customer = await resolveCustomerForPayload(supabase, alias, payload);
      await upsertPlatformConversationLink(supabase, alias, {
        conversationId,
        customerId: customer?.id ?? null,
        latestChannel: pickString(payload, ["channel", "response_channel"]),
        identityPhone: pickString(payload, ["identity_phone", "customerPhone"]),
        identityEmail: pickString(payload, ["identity_email", "customerEmail"]),
        metadata: {
          message_summary: pickString(payload, ["message_summary"]),
          provider_message_id: pickString(payload, ["provider_message_id"]),
          ...buildConversationSessionMetadata(payload),
        },
        latestEventAt: occurredAt,
      });
      return;
    }
    case "CreateCallbackTask": {
      if (!conversationId) {
        return;
      }

      const link = await upsertPlatformConversationLink(supabase, alias, {
        conversationId,
        latestChannel: "voice",
        identityPhone: pickString(payload, ["from"]),
        metadata: {
          call_sid: pickString(payload, ["call_sid"]),
          call_status: pickString(payload, ["call_status"]),
          ...buildConversationSessionMetadata(payload),
        },
        latestEventAt: occurredAt,
      });

      if (!link.callback_appointment_id) {
        const appointmentId = await createAppointment(supabase, alias, {
          link,
          type: "call",
          title: buildCallbackTitle(payload),
          startsAt: occurredAt,
          endsAt: addMinutes(occurredAt, 15),
        });

        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          callbackAppointmentId: appointmentId,
          latestEventAt: occurredAt,
        });
      }
      return;
    }
    case "CreateOrUpdateLeadFromConversation": {
      if (!conversationId) {
        return;
      }

      const link = await ensureLeadForConversation(supabase, alias, conversationId, payload);
      if (link.lead_id) {
        if (link.customer_id) {
          await attachLeadToCustomer(supabase, alias, link.lead_id, link.customer_id);
        }
        const noteBody = buildLeadNotes(payload);
        await updateLeadStatus(supabase, alias, link.lead_id, buildLeadStatus(payload), noteBody || null, payload);
        if (noteBody.length > 0) {
          await createNote(supabase, alias, {
            entityType: "lead",
            entityId: link.lead_id,
            body: `AI qualification update\n${noteBody}`,
          });
        }

        if (link.callback_appointment_id) {
          await updateAppointmentLeadReference(supabase, alias, link.callback_appointment_id, link.lead_id);
          if (link.customer_id) {
            await attachAppointmentToCustomer(supabase, alias, link.callback_appointment_id, link.customer_id);
          }
        }
      }
      return;
    }
    case "CreateEscalationTask": {
      if (!conversationId) {
        return;
      }

      let link = await ensureLeadForConversation(supabase, alias, conversationId, payload);
      const customer = await resolveCustomerForPayload(supabase, alias, payload);
      if (customer) {
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          customerId: customer.id,
          latestChannel: pickString(payload, ["channel", "response_channel"]),
          identityPhone: pickString(payload, ["identity_phone", "customer_phone", "customerPhone", "from"]),
          identityEmail: pickString(payload, ["identity_email", "customer_email", "customerEmail"]),
          latestEventAt: occurredAt,
        });
        if (link.lead_id) {
          await attachLeadToCustomer(supabase, alias, link.lead_id, customer.id);
        }
        link = { ...link, customer_id: customer.id };
      }
      const noteBody = [
        "AI escalation raised.",
        pickString(payload, ["trigger"]) ? `Trigger: ${pickString(payload, ["trigger"])}` : null,
        pickString(payload, ["response_text"]) ? `Response: ${pickString(payload, ["response_text"])}` : null,
      ]
        .filter((value): value is string => value !== null)
        .join("\n");

      if (link.lead_id) {
        await createNote(supabase, alias, {
          entityType: "lead",
          entityId: link.lead_id,
          body: noteBody,
        });
      }

      let callbackAppointmentId = link.callback_appointment_id;
      if (!callbackAppointmentId) {
        const appointmentId = await createAppointment(supabase, alias, {
          link,
          type: "follow_up",
          title: "AI escalation follow-up",
          startsAt: occurredAt,
          endsAt: addMinutes(occurredAt, 20),
        });
        callbackAppointmentId = appointmentId;
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          callbackAppointmentId: appointmentId,
          latestEventAt: occurredAt,
        });
      }
      if (link.customer_id && callbackAppointmentId) {
        await attachAppointmentToCustomer(supabase, alias, callbackAppointmentId, link.customer_id);
      }
      return;
    }
    case "CreateOrUpdateAppointment": {
      if (!conversationId) {
        return;
      }

      const link = await ensureBookingLeadForConversation(supabase, alias, conversationId, payload);
      const startsAt = toIsoString(pickString(payload, ["booking_start_at", "starts_at"]), command.issued_at);
      const endsAt = toIsoString(pickString(payload, ["booking_end_at", "ends_at"]), addMinutes(startsAt, 60));
      const bookingId = pickString(payload, ["booking_id", "booking_uid", "calcom_booking_id"]);
      const externalAppointment = bookingId ? await findAppointmentByExternalId(supabase, alias.tenant_id, bookingId) : null;
      const title = buildBookingTitle(payload);
      const bookingTimeZone = resolveBookingTimeZone(payload);
      const bookingClassification = await resolveBookingClassification(supabase, alias, payload);
      const visitClassification = inferVisitClassification(bookingClassification);
      const bookingAppointmentType = appointmentTypeForBookingClassification(bookingClassification);

      // EHS-V-001: derive postcode_status so the engineer diary shows a
      // "needs verification" badge when a voice booking confirmed without a
      // postcode (CJ-V-001 makes postcode soft-optional for voice because
      // UK postcodes are unreliable over ASR).
      const bookingChannel = pickString(payload, [
        "channel",
        "originating_channel",
        "latest_channel",
      ]);
      const bookingPostcode = pickString(payload, [
        "customer_postcode",
        "postcode",
      ]);
      const postcodeStatus = bookingPostcode
        ? "captured"
        : bookingChannel === "voice"
          ? "needs_verification"
          : null;

      if (link.lead_id) {
        await updateLeadStatus(
          supabase,
          alias,
          link.lead_id,
          visitClassification === "survey_assessment" ? "survey_booked" : "booked",
          buildLeadNotes(payload) || null,
          payload,
        );
        if (link.customer_id) {
          await attachLeadToCustomer(supabase, alias, link.lead_id, link.customer_id);
        }
      }

      let activeLink = link;
      const explicitJobId = pickString(payload, ["job_id"]);
      if (explicitJobId) {
        const explicitJob = await findJobById(supabase, alias.tenant_id, explicitJobId);
        if (explicitJob) {
          activeLink = await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            jobId: explicitJob.id,
            customerId: explicitJob.customer_id,
            latestEventAt: startsAt,
            metadata: {
              needs_review: false,
              review_reason: null,
            },
          });
        }
      }
      const customerResolution: BookingCustomerResolution = activeLink.customer_id
        ? { status: "resolved", customer: null }
        : await resolveCustomerForBookingPayload(supabase, alias, payload);
      if (customerResolution.status === "conflict") {
        const bookingCustomer = buildBookingCustomerIdentityFromPayload(payload);
        const reviewAppointmentId = externalAppointment?.id ?? (bookingId ? null : activeLink.booking_appointment_id);
        if (reviewAppointmentId) {
          await updateBookingAppointment(supabase, alias, {
            appointmentId: reviewAppointmentId,
            title,
            startsAt,
            endsAt,
            status: "scheduled",
            leadId: activeLink.lead_id,
            postcodeStatus,
            visitClassification,
            appointmentType: bookingAppointmentType,
            isTest: extractIsTestFromPayload(payload),
          });
        } else {
          const appointmentId = await createAppointment(supabase, alias, {
            link: { ...activeLink, customer_id: null, job_id: null },
            type: bookingAppointmentType,
            title,
            startsAt,
            endsAt,
            postcodeStatus,
            visitClassification,
            source: bookingId ? "platform" : "crm",
            externalId: bookingId,
          });
          activeLink = await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            bookingAppointmentId: appointmentId,
            latestEventAt: startsAt,
          });
        }
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          bookingAppointmentId: reviewAppointmentId ?? activeLink.booking_appointment_id,
          clearCustomerId: true,
          clearJobId: true,
          latestChannel: pickString(payload, ["channel", "response_channel"]),
          identityPhone: pickString(payload, ["identity_phone", "customer_phone", "customerPhone", "from"]),
          identityEmail: pickString(payload, ["identity_email", "customer_email", "customerEmail"]),
          latestEventAt: startsAt,
          metadata: buildBookingReviewMetadata({
            bookingId,
            externalLeadId: pickString(payload, ["lead_id", "platform_lead_id"]),
            channel: pickString(payload, ["channel", "response_channel"]),
            customer: bookingCustomer,
            conflict: customerResolution.conflict,
          }),
        });
        return;
      }

      if (customerResolution.customer) {
        activeLink = await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          customerId: customerResolution.customer.id,
          latestChannel: pickString(payload, ["channel", "response_channel"]),
          identityPhone: pickString(payload, ["identity_phone", "customer_phone", "customerPhone", "from"]),
          identityEmail: pickString(payload, ["identity_email", "customer_email", "customerEmail"]),
          latestEventAt: startsAt,
          metadata: {
            ...buildClassificationReviewMetadata(bookingClassification),
          },
        });
        if (activeLink.lead_id) {
          await attachLeadToCustomer(supabase, alias, activeLink.lead_id, customerResolution.customer.id);
        }
      }

      const linkedAppointmentId = externalAppointment?.id ?? (bookingId ? null : activeLink.booking_appointment_id);

      if (!linkedAppointmentId) {
        const appointmentId = await createAppointment(supabase, alias, {
          link: activeLink,
          type: bookingAppointmentType,
          title,
          startsAt,
          endsAt,
          confirmationEmailSentAt: pickString(payload, ["confirmation_email_sent_at"]),
          confirmationSmsSentAt: pickString(payload, ["confirmation_sms_sent_at"]),
          notificationStatus: pickString(payload, ["notification_status"]),
          notificationFailureReason: pickString(payload, ["notification_failure_reason"]),
          postcodeStatus: postcodeStatus,
          visitClassification,
          source: bookingId ? "platform" : "crm",
          externalId: bookingId,
        });
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          bookingAppointmentId: appointmentId,
          latestEventAt: startsAt,
          metadata: {
            platform_booking_id: bookingId,
            platform_lead_id: pickString(payload, ["lead_id", "platform_lead_id"]),
            booking_uid: pickString(payload, ["booking_uid", "calcom_booking_id"]),
            booking_slot_label: pickString(payload, ["booking_slot_label"]),
            ...buildClassificationReviewMetadata(bookingClassification),
            ...buildConversationSessionMetadata(payload),
          },
        });
      } else {
        // Map the platform-api booking_status to Empire's appointment status
        // enum. Default to "scheduled" so existing BookingConfirmed flows
        // remain unchanged; "completed" / "cancelled" override when the
        // platform-side lifecycle moves the booking on (e.g. the auto-close
        // worker firing BookingCompleted — Phase 2 of close-past-bookings PRD).
        const incomingBookingStatus = pickString(payload, ["booking_status", "status"]);
        const nextAppointmentStatus =
          incomingBookingStatus === "completed"
            ? "completed"
            : incomingBookingStatus === "cancelled"
              ? "cancelled"
              : "scheduled";
        await updateBookingAppointment(supabase, alias, {
          appointmentId: linkedAppointmentId,
          title,
          startsAt,
          endsAt,
          status: nextAppointmentStatus,
          customerId: activeLink.customer_id,
          leadId: activeLink.lead_id,
          jobId: activeLink.job_id,
          postcodeStatus,
          visitClassification,
          appointmentType: bookingAppointmentType,
          isTest: extractIsTestFromPayload(payload),
        });
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          bookingAppointmentId: linkedAppointmentId,
          latestEventAt: startsAt,
          metadata: {
            platform_booking_id: bookingId,
            platform_lead_id: pickString(payload, ["lead_id", "platform_lead_id"]),
            booking_uid: pickString(payload, ["booking_uid", "calcom_booking_id"]),
            booking_slot_label: pickString(payload, ["booking_slot_label"]),
            ...buildClassificationReviewMetadata(bookingClassification),
            ...buildConversationSessionMetadata(payload),
          },
        });
      }

      let refreshedLink = await getPlatformConversationLink(supabase, alias.tenant_id, conversationId);

      // Self-heal: if the Link command hasn't run (or didn't resolve a customer
      // for any reason), try to resolve one here so a diary job can be created
      // on this pass instead of being dropped silently.
      if (refreshedLink && !refreshedLink.customer_id) {
        const fallbackResolution = await resolveCustomerForBookingPayload(supabase, alias, payload);
        if (fallbackResolution.status === "resolved" && fallbackResolution.customer) {
          await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            customerId: fallbackResolution.customer.id,
            latestEventAt: startsAt,
          });
          refreshedLink = await getPlatformConversationLink(supabase, alias.tenant_id, conversationId);
        }
      }

      if (refreshedLink?.booking_appointment_id && refreshedLink.customer_id) {
        await attachAppointmentToCustomer(supabase, alias, refreshedLink.booking_appointment_id, refreshedLink.customer_id);
      }

      // Mirror the appointment self-heal for the lead. The earlier
      // attachLeadToCustomer at line ~1385 ran BEFORE the self-heal that
      // resolved the customer, so on a fresh BookingConfirmed-only flow
      // (no prior ConversationStarted to seed link.customer_id) the lead
      // ended up with customer_id=NULL even after the customer record
      // existed. Re-attempt the attach now that refreshedLink has the
      // customer resolved by the self-heal above.
      if (refreshedLink?.lead_id && refreshedLink.customer_id) {
        await attachLeadToCustomer(supabase, alias, refreshedLink.lead_id, refreshedLink.customer_id);
      }

      const assignedEngineer = pickString(payload, [
        "booking_resource_name",
        "resource_name",
        "engineer_name",
        "assigned_engineer",
      ]);

      // Auto-create a job so it appears in the engineer diary.
      // Only create when a customer is known and no job has been linked yet.
      let quoteAutomationJobId: string | null = null;
      if (refreshedLink?.customer_id && !refreshedLink.job_id) {
        const jobId = await createJobFromBooking(supabase, alias, {
          customerId: refreshedLink.customer_id,
          leadId: refreshedLink.lead_id,
          title,
          description: buildLeadNotes(payload) || null,
          startsAt,
          timeZone: bookingTimeZone,
          assignedEngineer,
          classification: bookingClassification,
          isTest: extractIsTestFromPayload(payload),
        });
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          jobId,
          latestEventAt: startsAt,
          metadata: buildClassificationReviewMetadata(bookingClassification),
        });
        if (refreshedLink.booking_appointment_id) {
          await attachAppointmentToJob(supabase, alias, refreshedLink.booking_appointment_id, jobId);
        }
        quoteAutomationJobId = jobId;
      } else if (refreshedLink?.job_id) {
        // A job was already linked (e.g. merged onto an existing one during
        // LinkConversationToCustomerOrJob). Refresh its schedule + title +
        // status from the incoming booking so the diary reflects the new slot
        // instead of the old one.
        const classificationConflictReason = await syncJobScheduleFromBooking(supabase, alias, {
          jobId: refreshedLink.job_id,
          title,
          description: buildLeadNotes(payload) || null,
          startsAt,
          timeZone: bookingTimeZone,
          assignedEngineer,
          classification: bookingClassification,
        });
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          latestEventAt: startsAt,
          metadata: {
            ...buildClassificationReviewMetadata(bookingClassification),
            ...(classificationConflictReason
              ? { needs_review: true, review_reason: classificationConflictReason }
              : {}),
          },
        });
        if (refreshedLink.booking_appointment_id) {
          await attachAppointmentToJob(supabase, alias, refreshedLink.booking_appointment_id, refreshedLink.job_id);
        }
        quoteAutomationJobId = refreshedLink.job_id;
      }

      if (quoteAutomationJobId) {
        try {
          await draftQuoteForJob({
            supabase,
            tenantId: alias.tenant_id,
            jobId: quoteAutomationJobId,
            actorId: null,
            triggerSource: "booking_created",
          });
        } catch (error) {
          console.error("[platform.command_executor] quote automation failed", {
            tenant_id: alias.tenant_id,
            job_id: quoteAutomationJobId,
            conversation_id: conversationId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return;
    }
    case "LinkConversationToCustomerOrJob": {
      if (!conversationId) {
        return;
      }

      const link = await getPlatformConversationLink(supabase, alias.tenant_id, conversationId);
      if (!link) {
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          latestEventAt: occurredAt,
        });
        return;
      }

      const explicitJobId = pickString(payload, ["job_id"]);
      if (link.job_id === null && explicitJobId) {
        const explicitJob = await findJobById(supabase, alias.tenant_id, explicitJobId);
        if (explicitJob) {
          await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            jobId: explicitJob.id,
            customerId: link.customer_id ?? explicitJob.customer_id,
            latestEventAt: occurredAt,
          });
          link.job_id = explicitJob.id;
          if (link.customer_id === null) {
            link.customer_id = explicitJob.customer_id;
          }
        }
      }

      const linkReason = pickString(payload, ["link_reason"]);
      if (link.customer_id === null) {
        const bookingLink = linkReason === "booking_confirmed";
        const customerResolution = bookingLink
          ? await resolveCustomerForBookingPayload(supabase, alias, payload)
          : { status: "resolved" as const, customer: await resolveCustomerForPayload(supabase, alias, payload) };
        if (customerResolution.status === "conflict") {
          await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            clearCustomerId: true,
            clearJobId: true,
            latestChannel: pickString(payload, ["channel", "response_channel"]),
            identityPhone: pickString(payload, ["identity_phone", "customer_phone", "customerPhone", "from"]),
            identityEmail: pickString(payload, ["identity_email", "customer_email", "customerEmail"]),
            latestEventAt: occurredAt,
            metadata: buildBookingReviewMetadata({
              bookingId: pickString(payload, ["booking_id", "booking_uid", "calcom_booking_id"]),
              externalLeadId: pickString(payload, ["lead_id", "platform_lead_id"]),
              channel: pickString(payload, ["channel", "response_channel"]),
              customer: buildBookingCustomerIdentityFromPayload(payload),
              conflict: customerResolution.conflict,
            }),
          });
          return;
        }
        const customer = customerResolution.customer;
        if (customer) {
          await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            customerId: customer.id,
            latestEventAt: occurredAt,
          });
          link.customer_id = customer.id;
        }
      }

      if (link.customer_id && link.job_id === null) {
        const job = await findLinkableJobForCustomer(supabase, alias.tenant_id, link.customer_id, payload);
        if (job) {
          await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            jobId: job.id,
            latestEventAt: occurredAt,
          });
          link.job_id = job.id;
        }
      }

      if (link.lead_id && link.booking_appointment_id) {
        await updateAppointmentLeadReference(supabase, alias, link.booking_appointment_id, link.lead_id);
      }
      if (link.lead_id && link.callback_appointment_id) {
        await updateAppointmentLeadReference(supabase, alias, link.callback_appointment_id, link.lead_id);
      }
      if (link.customer_id && link.booking_appointment_id) {
        await attachAppointmentToCustomer(supabase, alias, link.booking_appointment_id, link.customer_id);
      }
      if (link.customer_id && link.callback_appointment_id) {
        await attachAppointmentToCustomer(supabase, alias, link.callback_appointment_id, link.customer_id);
      }
      if (link.job_id && link.booking_appointment_id) {
        await attachAppointmentToJob(supabase, alias, link.booking_appointment_id, link.job_id);
      }
      if (link.job_id && link.callback_appointment_id) {
        await attachAppointmentToJob(supabase, alias, link.callback_appointment_id, link.job_id);
      }
      if (link.lead_id && link.customer_id) {
        await attachLeadToCustomer(supabase, alias, link.lead_id, link.customer_id);
      }
      return;
    }
    case "UpsertAppointmentFromPlatformBooking": {
      await upsertAppointmentFromPlatformBooking(supabase, alias, command);
      // Phase 4 usage metering — record every platform-sourced booking
      // as a billable unit. Failures are swallowed inside
      // recordUsageEvent so we never block the outbox.
      const bookingMeta = command.payload as { booking_action?: string; external_id?: string | null } | undefined;
      const action = bookingMeta?.booking_action ?? "confirmed";
      if (action !== "cancelled") {
        const { recordUsageEvent } = await import("@/modules/crm/lib/usage-metering");
        await recordUsageEvent(
          {
            tenantId: alias.tenant_id,
            eventType: `booking.${action}`,
            source: "platform-api",
            metadata: { external_id: bookingMeta?.external_id ?? null },
          },
          supabase,
        );
      }
      return;
    }
    case "CancelAppointmentFromPlatformBooking": {
      await cancelAppointmentFromPlatformBooking(supabase, alias, command);
      return;
    }
    case "UpsertLeadFromPlatform": {
      await upsertLeadFromPlatform(supabase, alias, command);
      return;
    }
    case "RecordResourceAvailabilityChange": {
      await recordResourceAvailabilityChange(supabase, alias, command);
      return;
    }
    default:
      return;
  }
}

export type BookingRecoveryAction =
  | { action: "create_new_customer_and_job" }
  | { action: "link_existing_customer"; customerId: string }
  | { action: "link_existing_job"; jobId: string };

export async function recoverBookingConfirmedEvent(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  event: PlatformEventEnvelope,
  recovery: BookingRecoveryAction,
) {
  const payload: Record<string, unknown> = {
    booking_status: "confirmed",
    recovery_action: recovery.action,
    ...asRecord(event.payload),
  };

  if (recovery.action === "create_new_customer_and_job") {
    payload.identity_resolution = "force_new_customer";
  }
  if (recovery.action === "link_existing_customer") {
    payload.identity_resolution = "link_customer";
    payload.recovery_customer_id = recovery.customerId;
  }
  if (recovery.action === "link_existing_job") {
    payload.job_id = recovery.jobId;
  }

  await executePlatformCommand(supabase, alias, {
    command_id: randomUUID(),
    command_type: "CreateOrUpdateAppointment",
    command_version: 1,
    workspace_id: alias.workspace_id,
    issued_at: new Date().toISOString(),
    source_system: "crm",
    target_system: "crm",
    idempotency_key: `${event.event_id}:booking-recovery:${recovery.action}`,
    correlation_id: event.correlation_id ?? event.event_id,
    causation_id: event.event_id,
    aggregate: event.aggregate,
    payload,
  });
}
