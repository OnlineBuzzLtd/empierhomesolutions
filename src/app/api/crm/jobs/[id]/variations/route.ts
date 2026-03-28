import { jobVariationSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["description"]);
    const parsed = jobVariationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid variation payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant, user, profile } = auth.session;
    if (parsed.data.status === "approved" && profile?.role !== "management" && profile?.role !== "admin") {
      return jsonError("Only managers can approve variations.", 403);
    }

    const approvedAt = parsed.data.status === "approved" ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .schema("crm")
      .from("job_variations")
      .insert({
        tenant_id: tenant.id,
        job_id: id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        estimated_value: parsed.data.estimated_value,
        status: parsed.data.status,
        created_by: user.id,
        approved_at: approvedAt,
      })
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ variation: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create job variation.", 400);
  }
}
