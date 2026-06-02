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

    const { data: pkg, error } = await supabase
      .schema("crm")
      .from("packages")
      .insert({
        tenant_id: tenant.id,
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
