import { jobPhaseSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; phaseId: string }> }) {
  try {
    const { id, phaseId } = await params;
    const body = normalizeBlankFields(await request.json(), ["description", "target_date", "sort_order"]);
    const parsed = jobPhaseSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid phase payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const completedAt = parsed.data.status
      ? parsed.data.status === "completed"
        ? new Date().toISOString()
        : null
      : undefined;

    const { supabase } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("job_phases")
      .update({
        ...parsed.data,
        completed_at: completedAt,
      })
      .eq("job_id", id)
      .eq("id", phaseId)
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ phase: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update job phase.", 400);
  }
}
