import { jobPhaseSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["description", "target_date", "sort_order"]);
    const parsed = jobPhaseSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid phase payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant } = auth.session;
    let sortOrder = parsed.data.sort_order ?? null;

    if (sortOrder === null) {
      const { data: existingPhases } = await supabase
        .schema("crm")
        .from("job_phases")
        .select("sort_order")
        .eq("job_id", id)
        .order("sort_order", { ascending: false })
        .limit(1);
      sortOrder = Number(existingPhases?.[0]?.sort_order ?? -1) + 1;
    }

    const { data, error } = await supabase
      .schema("crm")
      .from("job_phases")
      .insert({
        tenant_id: tenant.id,
        job_id: id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        sort_order: sortOrder,
        target_date: parsed.data.target_date ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ phase: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create job phase.", 400);
  }
}
