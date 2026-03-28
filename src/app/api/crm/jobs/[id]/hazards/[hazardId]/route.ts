import { jobHazardSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; hazardId: string }> }) {
  try {
    const { id, hazardId } = await params;
    const body = normalizeBlankFields(await request.json(), ["description"]);
    const parsed = jobHazardSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid hazard payload.");
    }
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase } = auth.session;
    const { data, error } = await supabase.schema("crm").from("job_hazards").update(parsed.data).eq("job_id", id).eq("id", hazardId).select("*").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ hazard: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update hazard.", 400);
  }
}
