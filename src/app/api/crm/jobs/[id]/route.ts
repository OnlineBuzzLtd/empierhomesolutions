import { jobSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";
import { jsonError, jsonSuccess, normalizeBlankFields, parseIdList, requireCrmApiUser } from "@/modules/crm/lib/api";
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

async function hasOpenComplianceItems(supabase: Awaited<ReturnType<typeof import("@/modules/crm/lib/supabase-server").createCrmServerClient>>, jobId: string) {
  const [hazards, checklists, certificates] = await Promise.all([
    supabase.schema("crm").from("job_hazards").select("id").eq("job_id", jobId).in("status", ["active", "mitigated"]),
    supabase.schema("crm").from("job_checklists").select("id").eq("job_id", jobId).eq("status", "required"),
    supabase.schema("crm").from("job_certificates").select("id").eq("job_id", jobId).eq("status", "draft"),
  ]);

  return {
    hazards: (hazards.data ?? []).length,
    checklists: (checklists.data ?? []).length,
    certificates: (certificates.data ?? []).length,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const parsed = jobSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid job payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant } = auth.session;
    const { data: existing } = await supabase
      .schema("crm")
      .from("jobs")
      .select("service_id, job_type_id, status, scheduled_date, scheduled_time, customer_id, lead_id, title")
      .eq("id", id)
      .single();
    const assignedEngineerIds = parseIdList(body.assigned_engineer_ids);
    const shouldSyncAssignees = Object.prototype.hasOwnProperty.call(body, "assigned_engineer_ids");

    if (existing && (parsed.data.status || parsed.data.service_id || parsed.data.job_type_id)) {
      const validation = await validateRequiredProgression({
        entityType: "job",
        entityId: id,
        serviceId: parsed.data.service_id ?? existing?.service_id,
        jobTypeId: parsed.data.job_type_id ?? existing?.job_type_id,
        pipelineStage: parsed.data.status ?? existing.status,
        incomingCustomFields: extractCustomFieldValues(body),
      });

      if (!validation.valid) {
        const messages = [
          validation.missingFields.length ? `required fields: ${validation.missingFields.join(", ")}` : null,
          validation.missingDocuments.length ? `required documents: ${validation.missingDocuments.join(", ")}` : null,
        ].filter(Boolean);
        return jsonError(`Cannot move job forward. Missing ${messages.join(" and ")}.`);
      }
    }

    const nextStatus = parsed.data.status ?? existing?.status;
    if (nextStatus === "completed" || nextStatus === "invoiced") {
      const compliance = await hasOpenComplianceItems(supabase, id);
      const blockers = [
        compliance.hazards > 0 ? `${compliance.hazards} unresolved hazards` : null,
        compliance.checklists > 0 ? `${compliance.checklists} incomplete checklists` : null,
        compliance.certificates > 0 ? `${compliance.certificates} draft certificates` : null,
      ].filter(Boolean);
      if (blockers.length > 0) {
        return jsonError(`Cannot complete job. Resolve ${blockers.join(", ")} first.`);
      }
    }

    const updatePayload = {
      ...parsed.data,
      assigned_engineer_ids: undefined,
    };
    const { data, error } = await supabase.schema("crm").from("jobs").update(updatePayload).eq("id", id).select("*").single();
    if (error) {
      return jsonError(error.message, 500);
    }

    let updatedJob = data;
    if (shouldSyncAssignees) {
      const assignedEngineerSummary = await syncJobAssignees(supabase, tenant.id, id, assignedEngineerIds);
      const { data: syncedJob, error: syncError } = await supabase
        .schema("crm")
        .from("jobs")
        .update({ assigned_engineer: assignedEngineerSummary || null })
        .eq("id", id)
        .select("*")
        .single();
      if (syncError) {
        return jsonError(syncError.message, 500);
      }
      updatedJob = syncedJob ?? data;
    }

    await upsertCustomFieldValues({
      entityType: "job",
      entityId: id,
      values: extractCustomFieldValues(body),
    });

    const schedulingChanged =
      existing !== null &&
      ((parsed.data.scheduled_date !== undefined && parsed.data.scheduled_date !== existing.scheduled_date) ||
        (parsed.data.scheduled_time !== undefined && parsed.data.scheduled_time !== existing.scheduled_time));

    if (schedulingChanged) {
      const occurredAt = String(updatedJob.updated_at ?? new Date().toISOString());
      const tenantId = String(tenant.id ?? updatedJob.tenant_id ?? "");
      await enqueueCrmPlatformEvent(supabase, {
        tenantId,
        eventType: "JobRescheduled",
        aggregateType: "job",
        aggregateId: updatedJob.id,
        idempotencyKey: `job:${updatedJob.id}:rescheduled:${occurredAt}`,
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
          previous_scheduled_date: existing?.scheduled_date ?? null,
          previous_scheduled_time: existing?.scheduled_time ?? null,
          scheduled_date: updatedJob.scheduled_date,
          scheduled_time: updatedJob.scheduled_time,
          duration_hours: updatedJob.duration_hours,
          assigned_engineer: updatedJob.assigned_engineer,
          status: updatedJob.status,
        },
      });
      await publishPendingPlatformOutboxEvents(supabase);
    }

    return jsonSuccess({ job: updatedJob });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update job.", 400);
  }
}
