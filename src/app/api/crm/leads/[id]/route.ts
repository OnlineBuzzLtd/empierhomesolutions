import { leadSchema } from "@/modules/crm/lib/validation";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { validateRequiredDocuments } from "@/modules/crm/lib/rules";
import { jsonError, jsonSuccess } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = leadSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid lead payload.");
  }

  const supabase = await createCrmServerClient();
  const { data: existing } = await supabase.schema("crm").from("leads").select("service_id, job_type_id").eq("id", id).single();

  if (parsed.data.status) {
    const validation = await validateRequiredDocuments({
      entityType: "lead",
      entityId: id,
      serviceId: parsed.data.service_id ?? existing?.service_id,
      jobTypeId: parsed.data.job_type_id ?? existing?.job_type_id,
      pipelineStage: parsed.data.status,
    });

    if (!validation.valid) {
      return jsonError(`Missing required documents: ${validation.missing.join(", ")}`);
    }
  }

  const { data, error } = await supabase.schema("crm").from("leads").update(parsed.data).eq("id", id).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  await upsertCustomFieldValues({
    entityType: "lead",
    entityId: id,
    values: extractCustomFieldValues(body),
  });

  return jsonSuccess({ lead: data });
}
