import { jobSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";

export async function POST(request: Request) {
  try {
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
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid job payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const customFieldValues = extractCustomFieldValues(body);
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

    const { supabase, user } = auth.session;

    const payload = {
      ...parsed.data,
      created_by: user?.id ?? null,
    };

    const { data, error } = await supabase.schema("crm").from("jobs").insert(payload).select("*").single();
    if (error) {
      return jsonError(error.message, 500);
    }

    await upsertCustomFieldValues({
      entityType: "job",
      entityId: data.id,
      values: customFieldValues,
    });

    return jsonSuccess({ job: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create job.", 400);
  }
}
