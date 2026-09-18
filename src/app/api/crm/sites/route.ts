import { siteSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { siteWriteError } from "@/modules/crm/lib/sites";

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(["management", "admin", "sales"]);
  if ("error" in auth) return auth.error;
  if (!getCrmEnv().multiSiteEnabled) return jsonError("Site management is not enabled.", 404);

  const parsed = siteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid site payload.");

  const { supabase, tenant } = auth.session;
  const { data: customer, error: customerError } = await supabase
    .schema("crm")
    .from("customers")
    .select("id, is_demo, demo_scenario_key")
    .eq("id", parsed.data.customer_id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (customerError) return siteWriteError(customerError);
  if (!customer) return jsonError("Customer does not belong to this workspace.", 404);

  // The database trigger switches primaries within this insert's transaction.
  const { data, error } = await supabase
    .schema("crm")
    .from("sites")
    .insert({
      ...parsed.data,
      tenant_id: tenant.id,
      is_primary: parsed.data.is_primary ?? false,
      is_demo: customer.is_demo ?? false,
      demo_scenario_key: customer.demo_scenario_key ?? null,
    })
    .select("*")
    .single();
  if (error) return siteWriteError(error);
  return jsonSuccess({ site: data });
}
