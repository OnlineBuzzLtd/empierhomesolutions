import { jobVariationSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; variationId: string }> }) {
  try {
    const { id, variationId } = await params;
    const body = normalizeBlankFields(await request.json(), ["description"]);
    const parsed = jobVariationSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid variation payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, profile } = auth.session;
    if (
      parsed.data.status &&
      ["approved", "declined", "invoiced"].includes(parsed.data.status) &&
      profile?.role !== "management" &&
      profile?.role !== "admin"
    ) {
      return jsonError("Only managers can approve or close variations.", 403);
    }

    const approvedAt =
      parsed.data.status === undefined
        ? undefined
        : parsed.data.status === "approved"
          ? new Date().toISOString()
          : null;

    const { data, error } = await supabase
      .schema("crm")
      .from("job_variations")
      .update({
        ...parsed.data,
        approved_at: approvedAt,
      })
      .eq("job_id", id)
      .eq("id", variationId)
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ variation: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update job variation.", 400);
  }
}
