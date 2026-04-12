import { jobSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess, normalizeBlankFields, parseIdList, requireCrmApiUser } from "@/modules/crm/lib/api";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";
import { enqueueCrmPlatformEvent, publishPendingPlatformOutboxEvents } from "@/modules/platform/lib/outbox";

async function syncJobAssignees(supabase: Awaited<ReturnType<typeof import("@/modules/crm/lib/supabase-server").createCrmServerClient>>, tenantId: string, jobId: string, userProfileIds: string[]) {
  const uniqueIds = [...new Set(userProfileIds)];
  const { error: deleteError } = await supabase.schema("crm").from("job_assignees").delete().eq("job_id", jobId);
  if (deleteError) {
    throw deleteError;
  }

  if (uniqueIds.length === 0) {
    return "";
  }

  const payload = uniqueIds.map((userProfileId) => ({
    tenant_id: tenantId,
    job_id: jobId,
    user_profile_id: userProfileId,
  }));
  const { error: insertError } = await supabase.schema("crm").from("job_assignees").insert(payload);
  if (insertError) {
    throw insertError;
  }

  const { data: profiles, error: profilesError } = await supabase.schema("crm").from("user_profiles").select("id, full_name").in("id", uniqueIds);
  if (profilesError) {
    throw profilesError;
  }

  return ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => profile.full_name?.trim()).filter(Boolean).join(", ");
}

export async function POST(request: Request) {
  try {
    const body = normalizeBlankFields(await request.json(), [
      "lead_id",
      "site_id",
      "site_contact_id",
      "service_id",
      "job_type_id",
      "description",
      "scheduled_date",
      "scheduled_time",
      "duration_hours",
      "assigned_engineer",
    ]);
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid job payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const customFieldValues = extractCustomFieldValues(body);
    const assignedEngineerIds = parseIdList(body.assigned_engineer_ids);
    const validation = await validateRequiredProgression({
      entityType: "job",
      entityId: "",
      serviceId: parsed.data.service_id,
      jobTypeId: parsed.data.job_type_id,
      pipelineStage: parsed.data.status,
      incomingCustomFields: customFieldValues,
      skipDocumentCheck: true,
    });
    if (!validation.valid) {
      return jsonError(`Missing required fields: ${validation.missingFields.join(", ")}`);
    }

    const { supabase, user, tenant } = auth.session;

    const payload = {
      ...parsed.data,
      created_by: user?.id ?? null,
      assigned_engineer_ids: undefined,
    };

    const { data, error } = await supabase.schema("crm").from("jobs").insert({
      ...payload,
      assigned_engineer: null,
    }).select("*").single();
    if (error) {
      return jsonError(error.message, 500);
    }

    const assignedEngineerSummary = await syncJobAssignees(supabase, tenant.id, data.id, assignedEngineerIds);
    const updatedJob =
      assignedEngineerSummary !== ""
        ? (
            await supabase
              .schema("crm")
              .from("jobs")
              .update({ assigned_engineer: assignedEngineerSummary })
              .eq("id", data.id)
              .select("*")
              .single()
          ).data ?? data
        : data;

    await upsertCustomFieldValues({
      entityType: "job",
      entityId: data.id,
      values: customFieldValues,
    });

    const occurredAt = String(updatedJob.updated_at ?? updatedJob.created_at ?? new Date().toISOString());
    const tenantId = String(tenant.id ?? updatedJob.tenant_id ?? "");
    await enqueueCrmPlatformEvent(supabase, {
      tenantId,
      eventType: "JobCreated",
      aggregateType: "job",
      aggregateId: updatedJob.id,
      idempotencyKey: `job:${updatedJob.id}:created:${occurredAt}`,
      occurredAt,
      payload: {
        job_id: updatedJob.id,
        customer_id: updatedJob.customer_id,
        lead_id: updatedJob.lead_id,
        title: updatedJob.title,
        problem_description: updatedJob.problem_description,
        affected_area: updatedJob.affected_area,
        urgency_level: updatedJob.urgency_level,
        preferred_date_text: updatedJob.preferred_date_text,
        preferred_time_window: updatedJob.preferred_time_window,
        status: updatedJob.status,
        scheduled_date: updatedJob.scheduled_date,
        scheduled_time: updatedJob.scheduled_time,
        duration_hours: updatedJob.duration_hours,
        assigned_engineer: updatedJob.assigned_engineer,
      },
    });
    await publishPendingPlatformOutboxEvents(supabase);

    return jsonSuccess({ job: updatedJob });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create job.", 400);
  }
}
