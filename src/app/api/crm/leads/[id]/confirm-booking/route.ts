import { z } from "zod";
import {
  jsonError,
  jsonSuccess,
  normalizeBlankFields,
  parseIdList,
  requireCrmApiUser,
  resolveCreatedByUserId,
} from "@/modules/crm/lib/api";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";
import { dispatchDueNotifications, scheduleNotification } from "@/modules/crm/notifications/scheduler";
import { syncAppointmentReminder24h } from "@/modules/crm/notifications/appointment-reminders";
import { draftQuoteForJob, type QuoteAutomationResult } from "@/modules/crm/lib/quote-automation";
import { enqueueCrmPlatformEvent, publishPendingPlatformOutboxEvents } from "@/modules/platform/lib/outbox";

const confirmationChannels = ["sms", "email"] as const;
const visitClassifications = [
  "standard",
  "survey_assessment",
  "install_work",
  "powerflush_work",
  "repair",
  "follow_up",
] as const;

const confirmBookingSchema = z.object({
  customer_id: z.string().uuid(),
  service_id: z.string().uuid(),
  job_type_id: z.string().uuid(),
  title: z.string().min(2),
  scheduled_date: z.string().min(1),
  scheduled_time: z.string().min(1),
  duration_hours: z.coerce.number().positive(),
  visit_classification: z.enum(visitClassifications).default("standard"),
  assigned_engineer_ids: z.array(z.string().uuid()).min(1, "Select an engineer before confirming the booking."),
  send_confirmation: z.boolean().default(false),
  confirmation_channels: z.array(z.enum(confirmationChannels)).default([]),
  duplicate_resolution_confirmed: z.boolean().default(false),
});

type SupabaseClient = Awaited<ReturnType<typeof import("@/modules/crm/lib/supabase-server").createCrmServerClient>>;

type LeadRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  possible_duplicate_customer_id: string | null;
  service_id: string | null;
  job_type_id: string | null;
  status: string;
  notes: string | null;
  problem_description?: string | null;
  affected_area?: string | null;
  urgency_level?: string | null;
  preferred_date_text?: string | null;
  preferred_time_window?: string | null;
  customer_match_result?: string | null;
  is_test?: boolean | null;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    postcode: string | null;
  } | null;
};

type UserProfileRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
};

type CustomerContactRow = NonNullable<LeadRow["customer"]>;

function parseBoolean(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on";
}

function parseChannels(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return values.filter((entry): entry is (typeof confirmationChannels)[number] =>
    confirmationChannels.includes(entry as (typeof confirmationChannels)[number]),
  );
}

function combineDateAndTime(date: string, time: string) {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  const start = new Date(`${date}T00:00:00.000`);
  start.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return start;
}

function formatAppointmentTime(startsAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(startsAt));
}

function cleanContact(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

async function cleanupCreatedRecords(
  supabase: SupabaseClient,
  input: { appointmentId: string | null; jobId: string | null },
) {
  if (input.appointmentId) {
    await supabase.schema("crm").from("appointments").delete().eq("id", input.appointmentId);
  }
  if (input.jobId) {
    await supabase.schema("crm").from("jobs").delete().eq("id", input.jobId);
  }
}

async function loadEngineerSummary(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[],
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("id, user_id, full_name")
    .eq("tenant_id", tenantId)
    .in("id", ids)
    .returns<UserProfileRow[]>();

  if (error) {
    throw error;
  }

  const profiles = data ?? [];
  if (profiles.length !== ids.length) {
    throw new Error("One or more selected engineers could not be found.");
  }

  return {
    profiles,
    summary: profiles.map((profile) => profile.full_name?.trim()).filter(Boolean).join(", "),
    appointmentAssigneeUserId: profiles[0]?.user_id ?? null,
  };
}

async function sendBookingConfirmations(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    lead: LeadRow;
    job: { id: string; title: string; is_test?: boolean | null };
    appointment: { id: string; starts_at: string };
    channels: Array<(typeof confirmationChannels)[number]>;
  },
) {
  const warnings: string[] = [];
  const now = new Date();
  const customer = input.lead.customer;
  const variables = {
    customer_name: customer?.full_name?.trim() || "there",
    service_name: input.job.title,
    appointment_time: formatAppointmentTime(input.appointment.starts_at),
  };

  for (const channel of input.channels) {
    try {
      const recipient = channel === "sms" ? cleanContact(customer?.phone) : cleanContact(customer?.email);
      if (!recipient) {
        warnings.push(`${channel.toUpperCase()} confirmation skipped: customer ${channel === "sms" ? "phone" : "email"} is missing.`);
        continue;
      }

      const rendered = await renderNotificationTemplate(supabase, {
        tenantId: input.tenantId,
        key: channel === "sms" ? "confirmation_sms" : "confirmation_email",
        channel,
        variables,
      });
      const notification = await scheduleNotification(supabase, {
        tenantId: input.tenantId,
        recipient,
        channel,
        templateKey: rendered.template.key,
        payload: channel === "sms" ? { body: rendered.body } : { subject: rendered.subject, html: rendered.body },
        dispatchAt: now,
        idempotencyKey: `appointment:${input.appointment.id}:confirmation_${channel}`,
        isTest: input.job.is_test === true || input.lead.is_test === true,
        metadata: {
          appointment_id: input.appointment.id,
          job_id: input.job.id,
          lead_id: input.lead.id,
          notification_type: "booking_confirmation",
        },
      });

      const dispatch = await dispatchDueNotifications(supabase, {
        now,
        onlyId: String(notification.id),
        limit: 1,
      });
      if (dispatch.failed > 0 || dispatch.sent === 0) {
        warnings.push(`${channel.toUpperCase()} confirmation queued but not sent yet.`);
        continue;
      }

      await supabase
        .schema("crm")
        .from("appointments")
        .update({
          [channel === "sms" ? "confirmation_sms_sent_at" : "confirmation_email_sent_at"]: now.toISOString(),
        })
        .eq("id", input.appointment.id);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `${channel.toUpperCase()} confirmation failed: ${error.message}`
          : `${channel.toUpperCase()} confirmation failed.`,
      );
    }
  }

  return warnings;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rawBody = await request.json();
  const body = normalizeBlankFields(
    {
      ...rawBody,
      assigned_engineer_ids: parseIdList(rawBody.assigned_engineer_ids),
      send_confirmation: parseBoolean(rawBody.send_confirmation),
      confirmation_channels: parseChannels(rawBody.confirmation_channels),
      duplicate_resolution_confirmed: parseBoolean(rawBody.duplicate_resolution_confirmed),
    },
    ["customer_id", "service_id", "job_type_id", "title", "scheduled_date", "scheduled_time"],
  );
  const parsed = confirmBookingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid booking payload.");
  }

  const auth = await requireCrmApiUser(["management", "admin", "sales"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant, user } = auth.session;
  let createdJobId: string | null = null;
  let createdAppointmentId: string | null = null;
  let stateCommitted = false;

  try {
    const { data: lead, error: leadError } = await supabase
      .schema("crm")
      .from("leads")
      .select(
        "id, tenant_id, customer_id, possible_duplicate_customer_id, service_id, job_type_id, status, notes, problem_description, affected_area, urgency_level, preferred_date_text, preferred_time_window, customer_match_result, is_test, customer:customers!leads_customer_id_fkey(id, full_name, phone, email, postcode)",
      )
      .eq("tenant_id", tenant.id)
      .eq("id", id)
      .maybeSingle<LeadRow>();

    if (leadError) {
      return jsonError(leadError.message, 500);
    }
    if (!lead) {
      return jsonError("Enquiry not found.", 404);
    }
    if (lead.status === "booked" || lead.status === "completed") {
      return jsonError("This enquiry has already been booked.");
    }
    if (
      lead.customer_match_result === "possible_duplicate" &&
      lead.possible_duplicate_customer_id &&
      !parsed.data.duplicate_resolution_confirmed
    ) {
      return jsonError("Choose the correct customer before confirming this duplicate enquiry.");
    }

    const { data: selectedCustomer, error: customerError } = await supabase
      .schema("crm")
      .from("customers")
      .select("id, full_name, phone, email, postcode")
      .eq("tenant_id", tenant.id)
      .eq("id", parsed.data.customer_id)
      .maybeSingle<CustomerContactRow>();
    if (customerError) {
      return jsonError(customerError.message, 500);
    }
    if (!selectedCustomer) {
      return jsonError("Selected customer was not found.");
    }

    const engineer = await loadEngineerSummary(supabase, tenant.id, parsed.data.assigned_engineer_ids);
    const jobPayload = {
      tenant_id: tenant.id,
      customer_id: parsed.data.customer_id,
      lead_id: lead.id,
      service_id: parsed.data.service_id,
      job_type_id: parsed.data.job_type_id,
      title: parsed.data.title,
      description: lead.notes ?? lead.problem_description ?? null,
      problem_description: lead.problem_description ?? null,
      affected_area: lead.affected_area ?? null,
      urgency_level: lead.urgency_level ?? null,
      preferred_date_text: lead.preferred_date_text ?? null,
      preferred_time_window: lead.preferred_time_window ?? null,
      scheduled_date: parsed.data.scheduled_date,
      scheduled_time: parsed.data.scheduled_time,
      duration_hours: parsed.data.duration_hours,
      visit_classification: parsed.data.visit_classification,
      commercial_stage: parsed.data.visit_classification === "survey_assessment" ? "survey_booked" : "booked",
      status: "booked",
      assigned_engineer: engineer.summary || null,
      created_by: resolveCreatedByUserId(user),
      is_test: lead.is_test === true,
    };

    const { data: job, error: jobError } = await supabase
      .schema("crm")
      .from("jobs")
      .insert(jobPayload)
      .select("*")
      .single();
    if (jobError) {
      return jsonError(jobError.message, 500);
    }
    createdJobId = job.id;

    const assigneeRows = parsed.data.assigned_engineer_ids.map((userProfileId) => ({
      tenant_id: tenant.id,
      job_id: job.id,
      user_profile_id: userProfileId,
    }));
    const { error: assigneeError } = await supabase.schema("crm").from("job_assignees").insert(assigneeRows);
    if (assigneeError) {
      throw assigneeError;
    }

    const startsAt = combineDateAndTime(parsed.data.scheduled_date, parsed.data.scheduled_time);
    const endsAt = new Date(startsAt.getTime() + parsed.data.duration_hours * 60 * 60 * 1000);
    const { data: appointment, error: appointmentError } = await supabase
      .schema("crm")
      .from("appointments")
      .insert({
        tenant_id: tenant.id,
        customer_id: parsed.data.customer_id,
        lead_id: lead.id,
        job_id: job.id,
        assigned_to: engineer.appointmentAssigneeUserId,
        type: parsed.data.visit_classification === "survey_assessment" ? "survey" : "booking",
        visit_classification: parsed.data.visit_classification,
        title: parsed.data.title,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "scheduled",
        is_test: lead.is_test === true,
      })
      .select("*")
      .single();
    if (appointmentError) {
      throw appointmentError;
    }
    createdAppointmentId = appointment.id;

    const { data: updatedLead, error: leadUpdateError } = await supabase
      .schema("crm")
      .from("leads")
      .update({
        customer_id: parsed.data.customer_id,
        service_id: parsed.data.service_id,
        job_type_id: parsed.data.job_type_id,
        status: parsed.data.visit_classification === "survey_assessment" ? "survey_booked" : "booked",
        next_action_at: null,
      })
      .eq("tenant_id", tenant.id)
      .eq("id", lead.id)
      .select("*")
      .single();
    if (leadUpdateError) {
      throw leadUpdateError;
    }
    stateCommitted = true;

    await syncAppointmentReminder24h(supabase, tenant.id, appointment);

    const occurredAt = String(job.updated_at ?? job.created_at ?? new Date().toISOString());
    await enqueueCrmPlatformEvent(supabase, {
      tenantId: tenant.id,
      eventType: "JobCreated",
      aggregateType: "job",
      aggregateId: job.id,
      idempotencyKey: `job:${job.id}:created:${occurredAt}`,
      occurredAt,
      payload: {
        job_id: job.id,
        customer_id: job.customer_id,
        lead_id: job.lead_id,
        title: job.title,
        problem_description: job.problem_description,
        affected_area: job.affected_area,
        urgency_level: job.urgency_level,
        preferred_date_text: job.preferred_date_text,
        preferred_time_window: job.preferred_time_window,
        status: job.status,
        scheduled_date: job.scheduled_date,
        scheduled_time: job.scheduled_time,
        duration_hours: job.duration_hours,
        assigned_engineer: job.assigned_engineer,
      },
    });
    await publishPendingPlatformOutboxEvents(supabase);

    const confirmationWarnings =
      parsed.data.send_confirmation && parsed.data.confirmation_channels.length > 0
        ? await sendBookingConfirmations(supabase, {
            tenantId: tenant.id,
            lead: {
              ...lead,
              customer: selectedCustomer,
            },
            job,
            appointment,
            channels: parsed.data.confirmation_channels,
          })
        : [];
    let quoteAutomation: QuoteAutomationResult | null = null;
    try {
      quoteAutomation = await draftQuoteForJob({
        supabase,
        tenantId: tenant.id,
        jobId: job.id,
        actorId: resolveCreatedByUserId(user),
        triggerSource: "booking_created",
      });
    } catch (error) {
      console.error("[crm.leads.confirm_booking] quote automation failed", {
        tenant_id: tenant.id,
        job_id: job.id,
        lead_id: lead.id,
        error: error instanceof Error ? error.message : String(error),
      });
      quoteAutomation = {
        status: "blocked",
        quoteId: null,
        invoiceScheduleIds: [],
        blockers: [
          {
            code: "automation_failed",
            message: error instanceof Error ? error.message : "Quote automation failed after booking.",
          },
        ],
        warnings: ["Booking was confirmed, but quote automation failed."],
        automationMetadata: { trigger_source: "booking_created", job_id: job.id, lead_id: lead.id },
      };
    }

    return jsonSuccess({
      job,
      appointment,
      lead: updatedLead,
      confirmationWarnings,
      quoteAutomation,
    });
  } catch (error) {
    if (!stateCommitted) {
      await cleanupCreatedRecords(supabase, { appointmentId: createdAppointmentId, jobId: createdJobId }).catch(() => undefined);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to confirm booking.", 400);
  }
}
