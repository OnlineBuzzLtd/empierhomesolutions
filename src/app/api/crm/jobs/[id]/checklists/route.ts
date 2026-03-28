import { jobChecklistSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["notes"]);
    const parsed = jobChecklistSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid checklist payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase.schema("crm").from("job_checklists").insert({
      tenant_id: tenant.id,
      job_id: id,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status,
      completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
    }).select("*").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ checklist: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create checklist.", 400);
  }
}
