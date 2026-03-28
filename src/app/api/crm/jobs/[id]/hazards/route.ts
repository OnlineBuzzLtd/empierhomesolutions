import { jobHazardSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["description"]);
    const parsed = jobHazardSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid hazard payload.");
    }
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase.schema("crm").from("job_hazards").insert({
      tenant_id: tenant.id,
      job_id: id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
    }).select("*").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ hazard: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create hazard.", 400);
  }
}
