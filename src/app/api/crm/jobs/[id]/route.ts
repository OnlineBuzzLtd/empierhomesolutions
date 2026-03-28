import { jobSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";
import { jsonError, jsonSuccess, normalizeBlankFields, parseIdList, requireCrmApiUser } from "@/modules/crm/lib/api";

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
    const { data: existing } = await supabase.schema("crm").from("jobs").select("service_id, job_type_id, status").eq("id", id).single();
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

    return jsonSuccess({ job: updatedJob });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update job.", 400);
  }
}
