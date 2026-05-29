import type { SupabaseClient } from "@supabase/supabase-js";
import type { FsmProviderKey } from "@/modules/crm/integrations/fsm/registry";
import { scheduleReviewRequestsForCompletedJob } from "@/modules/crm/notifications/review-requests";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

function isCompletedStatus(value: string | null) {
  return ["completed", "complete", "closed", "finished", "done"].includes((value ?? "").toLowerCase());
}

export function extractFsmCompletionPayload(provider: Exclude<FsmProviderKey, "none">, body: unknown) {
  const root = asRecord(body);
  const event = asRecord(root.event ?? root.job ?? root.data ?? root);
  const status = pickString(event, ["status", "job_status", "state"]);
  return {
    provider,
    externalId: pickString(event, ["uuid", "id", "job_id", "jobId", "reference", "external_id"]) ?? pickString(root, ["uuid", "id"]),
    status,
    completed: isCompletedStatus(status),
    raw: root,
  };
}

export async function processFsmCompletionWebhook(
  supabase: SupabaseClient,
  input: { provider: Exclude<FsmProviderKey, "none">; body: unknown },
) {
  const payload = extractFsmCompletionPayload(input.provider, input.body);
  if (!payload.externalId) {
    return { processed: false, ignored: "missing_external_id" };
  }
  if (!payload.completed) {
    return { processed: false, ignored: "not_completed", status: payload.status };
  }

  const { data: appointment, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id, tenant_id, job_id")
    .eq("external_fsm_provider", input.provider)
    .eq("external_fsm_id", payload.externalId)
    .maybeSingle<{ id: string; tenant_id: string; job_id: string | null }>();
  if (error) {
    throw error;
  }
  if (!appointment) {
    return { processed: false, ignored: "appointment_not_found" };
  }

  const completedAt = new Date().toISOString();
  const { error: appointmentError } = await supabase
    .schema("crm")
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", appointment.id);
  if (appointmentError) {
    throw appointmentError;
  }

  if (appointment.job_id) {
    const { data: job, error: jobError } = await supabase
      .schema("crm")
      .from("jobs")
      .update({ status: "completed" })
      .eq("id", appointment.job_id)
      .select("id, tenant_id, customer_id")
      .maybeSingle<{ id: string; tenant_id: string; customer_id: string | null }>();
    if (jobError) {
      throw jobError;
    }
    if (job?.customer_id) {
      await scheduleReviewRequestsForCompletedJob(supabase, {
        tenantId: job.tenant_id,
        jobId: job.id,
        completedAt: new Date(completedAt),
      });
    }
  }

  return { processed: true, appointmentId: appointment.id, jobId: appointment.job_id };
}
