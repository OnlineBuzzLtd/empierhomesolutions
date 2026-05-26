import { siteContactSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCrmApiUser(["management", "admin", "sales"]);
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["phone", "email", "role_label"]);
    const parsed = siteContactSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid site contact payload.");
    }

    const { supabase, tenant } = auth.session;
    if (parsed.data.site_id) {
      const { data: site, error: siteError } = await supabase
        .schema("crm")
        .from("sites")
        .select("id, tenant_id")
        .eq("id", parsed.data.site_id)
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (siteError) {
        return jsonError(siteError.message, 500);
      }
      if (!site) {
        return jsonError("Site does not belong to this workspace.", 404);
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.site_id !== undefined) updatePayload.site_id = parsed.data.site_id;
    if (parsed.data.full_name !== undefined) updatePayload.full_name = parsed.data.full_name;
    if (parsed.data.phone !== undefined) updatePayload.phone = parsed.data.phone || null;
    if (parsed.data.email !== undefined) updatePayload.email = parsed.data.email || null;
    if (parsed.data.role_label !== undefined) updatePayload.role_label = parsed.data.role_label || null;
    if (parsed.data.is_primary !== undefined) updatePayload.is_primary = parsed.data.is_primary;

    const { data, error } = await supabase
      .schema("crm")
      .from("site_contacts")
      .update(updatePayload)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ site_contact: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update site contact.", 400);
  }
}
