import { packageSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";

export async function GET() {
  try {
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("packages")
      .select("*, items:package_items(*)")
      .order("name", { ascending: true });
    if (error) {
      return jsonError(error.message, 500);
    }
    return jsonSuccess({ packages: data ?? [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load packages.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = packageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid package payload.");
    }

    const { supabase, tenant, user } = auth.session;
    const { data: pkg, error } = await supabase
      .schema("crm")
      .from("packages")
      .insert({
        tenant_id: tenant.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        default_markup_percent: parsed.data.default_markup_percent ?? null,
        is_active: parsed.data.is_active,
        image_url: parsed.data.image_url ?? null,
        created_by: resolveCreatedByUserId(user),
      })
      .select("*")
      .single();
    if (error || !pkg) {
      return jsonError(error?.message ?? "Failed to create package.", 500);
    }

    if (parsed.data.items.length > 0) {
      const itemsPayload = parsed.data.items.map((item, index) => ({
        tenant_id: tenant.id,
        package_id: pkg.id,
        product_id: item.product_id ?? null,
        description: item.description,
        qty: item.qty,
        unit_cost: item.unit_cost ?? null,
        unit_price: item.unit_price,
        sort_order: item.sort_order ?? index,
      }));
      const { error: itemsError } = await supabase.schema("crm").from("package_items").insert(itemsPayload);
      if (itemsError) {
        return jsonError(itemsError.message, 500);
      }
    }

    return jsonSuccess({ package: pkg });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create package.", 500);
  }
}
