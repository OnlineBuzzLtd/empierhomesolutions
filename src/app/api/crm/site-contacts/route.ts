import { siteContactSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  try {
    const auth = await requireCrmApiUser(["management", "admin", "sales"]);
    if ("error" in auth) {
      return auth.error;
    }

    const body = normalizeBlankFields(await request.json(), ["phone", "email", "role_label"]);
    const parsed = siteContactSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid site contact payload.");
    }

    const { supabase, tenant } = auth.session;
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

    const { data, error } = await supabase
      .schema("crm")
      .from("site_contacts")
      .insert({
        tenant_id: tenant.id,
        site_id: parsed.data.site_id,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        role_label: parsed.data.role_label || null,
        is_primary: parsed.data.is_primary ?? false,
      })
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ site_contact: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create site contact.", 400);
  }
}
