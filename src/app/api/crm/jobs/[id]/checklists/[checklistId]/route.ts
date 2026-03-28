import { jobChecklistSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; checklistId: string }> }) {
  try {
    const { id, checklistId } = await params;
    const body = normalizeBlankFields(await request.json(), ["notes"]);
    const parsed = jobChecklistSchema.partial().safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid checklist payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase } = auth.session;
    const { data, error } = await supabase.schema("crm").from("job_checklists").update({
      ...parsed.data,
      completed_at: parsed.data.status ? (parsed.data.status === "completed" ? new Date().toISOString() : null) : undefined,
    }).eq("job_id", id).eq("id", checklistId).select("*").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ checklist: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update checklist.", 400);
  }
}
