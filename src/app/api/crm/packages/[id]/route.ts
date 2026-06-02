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
    if (parsed.data.job_type_id && !parsed.data.service_id) {
      return jsonError("Select a service before selecting a job type.");
    }
    if (parsed.data.job_type_id && parsed.data.service_id) {
      const { data: jobType, error: jobTypeError } = await supabase
        .schema("crm")
        .from("job_types")
        .select("id")
        .eq("id", parsed.data.job_type_id)
        .eq("service_id", parsed.data.service_id)
        .maybeSingle();
      if (jobTypeError) {
        return jsonError(jobTypeError.message, 500);
      }
      if (!jobType) {
        return jsonError("Job type must belong to the selected service.");
      }
    }

    const { error: updateError } = await supabase
      .schema("crm")
      .from("packages")
      .update({
        service_id: parsed.data.service_id ?? null,
        job_type_id: parsed.data.job_type_id ?? null,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        default_markup_percent: parsed.data.default_markup_percent ?? null,
        is_active: parsed.data.is_active,
        image_url: parsed.data.image_url ?? null,
        ai_visible: parsed.data.ai_visible,
        ai_bookable: parsed.data.ai_bookable,
        ai_price_enabled: parsed.data.ai_price_enabled,
        ai_requires_office_quote: parsed.data.ai_requires_office_quote,
        ai_default_duration_minutes: parsed.data.ai_default_duration_minutes ?? null,
        ai_price_disclaimer: parsed.data.ai_price_disclaimer ?? null,
        ai_pricing_style: parsed.data.ai_pricing_style,
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
