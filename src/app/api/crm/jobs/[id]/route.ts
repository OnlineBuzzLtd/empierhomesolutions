import { jobSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), [
      "lead_id",
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

    const { supabase } = auth.session;
    const { data: existing } = await supabase.schema("crm").from("jobs").select("service_id, job_type_id, status").eq("id", id).single();

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

    const { data, error } = await supabase.schema("crm").from("jobs").update(parsed.data).eq("id", id).select("*").single();
    if (error) {
      return jsonError(error.message, 500);
    }

    await upsertCustomFieldValues({
      entityType: "job",
      entityId: id,
      values: extractCustomFieldValues(body),
    });

    return jsonSuccess({ job: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update job.", 400);
  }
}
