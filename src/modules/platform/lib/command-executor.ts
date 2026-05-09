import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppointmentStatus, AppointmentType, LeadStatus } from "@/modules/crm/types";
import type { PlatformCommandEnvelope } from "@/modules/platform/contracts";
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

function normalizePostcode(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, "").toUpperCase();
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
      notes: buildLeadNotes(payload) || null,
      ...leadFieldPatch,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw error ?? new Error("Failed to create CRM lead from platform command.");
  }

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
      address_line1: pickString(payload, ["serviceAddressLine1", "service_address_line1", "address_line1"]),
      city: pickString(payload, ["serviceCity", "service_city", "city"]),
      postcode: pickString(payload, ["servicePostcode", "customer_postcode", "postcode"]),
      source: buildLeadSource(payload),
      notes: buildLeadNotes(payload) || null,
      archived: false,
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
  const nextAddressLine1 = pickString(payload, ["serviceAddressLine1", "service_address_line1", "address_line1"]);
  const nextCity = pickString(payload, ["serviceCity", "service_city", "city"]);
  const nextPostcode = pickString(payload, ["servicePostcode", "customer_postcode", "postcode"]);

  if (!customer.full_name && nextName) {
    patch.full_name = nextName;
  }
  if (!customer.first_name && (nextFirstName || nextName)) {
    patch.first_name = nextFirstName ?? splitNameParts(nextName).firstName;
  }
  if (!customer.last_name && (nextLastName || nextName)) {
    patch.last_name = nextLastName ?? splitNameParts(nextName).lastName;
  }
  if (!customer.phone && nextPhone) {
    patch.phone = nextPhone;
  }
  if (!customer.email && nextEmail) {
    patch.email = nextEmail;
  }
  if (!customer.address_line1 && nextAddressLine1) {
    patch.address_line1 = nextAddressLine1;
  }
  if (!customer.city && nextCity) {
    patch.city = nextCity;
  }
  if (!customer.postcode && nextPostcode) {
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

async function syncJobScheduleFromBooking(
  supabase: SupabaseClient,
  alias: WorkspaceAlias,
  input: {
    jobId: string;
    title: string;
    description: string | null;
    startsAt: string;
    assignedEngineer: string | null;
  },
): Promise<void> {
  const scheduledDate = input.startsAt.slice(0, 10);
  const scheduledTime = input.startsAt.slice(11, 16);

  const updatePayload: Record<string, unknown> = {
    title: input.title,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    status: "booked",
  };
  if (input.description) {
    updatePayload.description = input.description;
  }
  if (input.assignedEngineer) {
    updatePayload.assigned_engineer = input.assignedEngineer;
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
    assignedEngineer: string | null;
  },
): Promise<string> {
  const scheduledDate = input.startsAt.slice(0, 10);
  const scheduledTime = input.startsAt.slice(11, 16);

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
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      assigned_engineer: input.assignedEngineer ?? null,
      is_demo: false,
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
      confirmation_email_sent_at: input.confirmationEmailSentAt ?? null,
      confirmation_sms_sent_at: input.confirmationSmsSentAt ?? null,
      notification_status: input.notificationStatus ?? null,
      notification_failure_reason: input.notificationFailureReason ?? null,
      postcode_status: input.postcodeStatus ?? null,
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
};

function extractPlatformBookingPayload(payload: Record<string, unknown>, fallbackStart: string): PlatformBookingPayload {
  const customer = asRecord(payload.customer);
  const start = toIsoString(pickString(payload, ["start_at", "booking_start_at", "starts_at"]), fallbackStart);
  const end = toIsoString(pickString(payload, ["end_at", "booking_end_at", "ends_at"]), addMinutes(start, 60));
  return {
    bookingId: pickString(payload, ["booking_id", "booking_uid"]),
    startAt: start,
    endAt: end,
    status: pickString(payload, ["status", "booking_status"]),
    action: pickString(payload, ["booking_action"]),
    resourceId: pickString(payload, ["resource_id", "booking_resource_id"]),
    resourceName: pickString(payload, ["resource_name", "booking_resource_name"]),
    serviceName: pickString(payload, ["service_name", "service_key", "serviceCategory"]),
    conversationId: pickString(payload, ["conversation_id"]),
    customer: {
      name: pickString(customer, ["name", "full_name"]) ?? pickString(payload, ["customerName"]),
      phone: pickString(customer, ["phone"]) ?? pickString(payload, ["customerPhone", "identity_phone"]),
      email: pickString(customer, ["email"]) ?? pickString(payload, ["customerEmail", "identity_email"]),
      addressLine1: pickString(customer, ["address_line1"]) ?? pickString(payload, ["serviceAddressLine1"]),
      city: pickString(customer, ["city"]) ?? pickString(payload, ["serviceCity"]),
      postcode: pickString(customer, ["postcode"]) ?? pickString(payload, ["servicePostcode"]),
    },
    metadata: (() => {
      const raw = asRecord(payload.metadata);
      return Object.keys(raw).length > 0 ? raw : null;
    })(),
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
    return updateCustomerFromPayload(supabase, alias, existing, flat);
  }

  return createCustomerFromPayload(supabase, alias, flat);
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

      const link = await ensureLeadForConversation(supabase, alias, conversationId, payload);
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

      if (!link.callback_appointment_id) {
        const appointmentId = await createAppointment(supabase, alias, {
          link,
          type: "follow_up",
          title: "AI escalation follow-up",
          startsAt: occurredAt,
          endsAt: addMinutes(occurredAt, 20),
        });
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          callbackAppointmentId: appointmentId,
          latestEventAt: occurredAt,
        });
      }
      if (link.customer_id && link.callback_appointment_id) {
        await attachAppointmentToCustomer(supabase, alias, link.callback_appointment_id, link.customer_id);
      }
      return;
    }
    case "CreateOrUpdateAppointment": {
      if (!conversationId) {
        return;
      }

      const link = await ensureLeadForConversation(supabase, alias, conversationId, payload);
      const startsAt = toIsoString(pickString(payload, ["booking_start_at", "starts_at"]), command.issued_at);
      const endsAt = toIsoString(pickString(payload, ["booking_end_at", "ends_at"]), addMinutes(startsAt, 60));

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
        await updateLeadStatus(supabase, alias, link.lead_id, "booked", buildLeadNotes(payload) || null, payload);
        if (link.customer_id) {
          await attachLeadToCustomer(supabase, alias, link.lead_id, link.customer_id);
        }
      }

      if (!link.booking_appointment_id) {
        const appointmentId = await createAppointment(supabase, alias, {
          link,
          type: "booking",
          title: buildBookingTitle(payload),
          startsAt,
          endsAt,
          confirmationEmailSentAt: pickString(payload, ["confirmation_email_sent_at"]),
          confirmationSmsSentAt: pickString(payload, ["confirmation_sms_sent_at"]),
          notificationStatus: pickString(payload, ["notification_status"]),
          notificationFailureReason: pickString(payload, ["notification_failure_reason"]),
          postcodeStatus: postcodeStatus,
        });
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          bookingAppointmentId: appointmentId,
          latestEventAt: startsAt,
          metadata: {
            booking_uid: pickString(payload, ["booking_uid", "calcom_booking_id"]),
            booking_slot_label: pickString(payload, ["booking_slot_label"]),
            ...buildConversationSessionMetadata(payload),
          },
        });
      } else {
        await supabase
          .schema("crm")
          .from("appointments")
          .update({
            title: buildBookingTitle(payload),
            starts_at: startsAt,
            ends_at: endsAt,
            status: "scheduled",
            // Only overwrite postcode_status when we have new info
            // (otherwise leave whatever a previous BookingConfirmed set).
            ...(postcodeStatus ? { postcode_status: postcodeStatus } : {}),
          })
          .eq("id", link.booking_appointment_id)
          .eq("tenant_id", alias.tenant_id);
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          latestEventAt: startsAt,
          metadata: {
            booking_uid: pickString(payload, ["booking_uid", "calcom_booking_id"]),
            booking_slot_label: pickString(payload, ["booking_slot_label"]),
            ...buildConversationSessionMetadata(payload),
          },
        });
      }

      let refreshedLink = await getPlatformConversationLink(supabase, alias.tenant_id, conversationId);

      // Self-heal: if the Link command hasn't run (or didn't resolve a customer
      // for any reason), try to resolve one here so a diary job can be created
      // on this pass instead of being dropped silently.
      if (refreshedLink && !refreshedLink.customer_id) {
        const fallbackCustomer = await resolveCustomerForPayload(supabase, alias, payload);
        if (fallbackCustomer) {
          await upsertPlatformConversationLink(supabase, alias, {
            conversationId,
            customerId: fallbackCustomer.id,
            latestEventAt: startsAt,
          });
          refreshedLink = await getPlatformConversationLink(supabase, alias.tenant_id, conversationId);
        }
      }

      if (refreshedLink?.booking_appointment_id && refreshedLink.customer_id) {
        await attachAppointmentToCustomer(supabase, alias, refreshedLink.booking_appointment_id, refreshedLink.customer_id);
      }

      const assignedEngineer = pickString(payload, [
        "booking_resource_name",
        "resource_name",
        "engineer_name",
        "assigned_engineer",
      ]);

      // Auto-create a job so it appears in the engineer diary.
      // Only create when a customer is known and no job has been linked yet.
      if (refreshedLink?.customer_id && !refreshedLink.job_id) {
        const jobId = await createJobFromBooking(supabase, alias, {
          customerId: refreshedLink.customer_id,
          leadId: refreshedLink.lead_id,
          title: buildBookingTitle(payload),
          description: buildLeadNotes(payload) || null,
          startsAt,
          assignedEngineer,
        });
        await upsertPlatformConversationLink(supabase, alias, {
          conversationId,
          jobId,
          latestEventAt: startsAt,
        });
        if (refreshedLink.booking_appointment_id) {
          await attachAppointmentToJob(supabase, alias, refreshedLink.booking_appointment_id, jobId);
        }
      } else if (refreshedLink?.job_id) {
        // A job was already linked (e.g. merged onto an existing one during
        // LinkConversationToCustomerOrJob). Refresh its schedule + title +
        // status from the incoming booking so the diary reflects the new slot
        // instead of the old one.
        await syncJobScheduleFromBooking(supabase, alias, {
          jobId: refreshedLink.job_id,
          title: buildBookingTitle(payload),
          description: buildLeadNotes(payload) || null,
          startsAt,
          assignedEngineer,
        });
        if (refreshedLink.booking_appointment_id) {
          await attachAppointmentToJob(supabase, alias, refreshedLink.booking_appointment_id, refreshedLink.job_id);
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

      if (link.customer_id === null) {
        const customer = await resolveCustomerForPayload(supabase, alias, payload);
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
