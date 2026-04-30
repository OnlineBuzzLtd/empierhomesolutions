import { packageSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("packages")
      .select("*, items:package_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return jsonError(error.message, 500);
    }
    if (!data) {
      return jsonError("Package not found.", 404);
    }
    return jsonSuccess({ package: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load package.", 500);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = packageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid package payload.");
    }

    const { supabase, tenant } = auth.session;
    const { error: updateError } = await supabase
      .schema("crm")
      .from("packages")
      .update({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        default_markup_percent: parsed.data.default_markup_percent ?? null,
        is_active: parsed.data.is_active,
      })
      .eq("id", id);
    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    // Replace items: delete existing, insert new. Cheap and atomic from
    // the user's POV (single PUT). RLS prevents cross-tenant.
    const { error: delError } = await supabase.schema("crm").from("package_items").delete().eq("package_id", id);
    if (delError) {
      return jsonError(delError.message, 500);
    }

    if (parsed.data.items.length > 0) {
      const itemsPayload = parsed.data.items.map((item, index) => ({
        tenant_id: tenant.id,
        package_id: id,
        product_id: item.product_id ?? null,
        description: item.description,
        qty: item.qty,
        unit_cost: item.unit_cost ?? null,
        unit_price: item.unit_price,
        sort_order: item.sort_order ?? index,
      }));
      const { error: insErr } = await supabase.schema("crm").from("package_items").insert(itemsPayload);
      if (insErr) {
        return jsonError(insErr.message, 500);
      }
    }

    return jsonSuccess({ id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update package.", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireManagerCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase } = auth.session;
    const { error } = await supabase.schema("crm").from("packages").delete().eq("id", id);
    if (error) {
      return jsonError(error.message, 500);
    }
    return jsonSuccess({ id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete package.", 500);
  }
}
