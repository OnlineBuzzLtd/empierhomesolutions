import { z } from "zod";
import { sitePatchSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { siteWriteError } from "@/modules/crm/lib/sites";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireCrmApiUser(["management", "admin", "sales"]);
  if ("error" in auth) return auth.error;
  const env = getCrmEnv();
  if (!env.siteEditingEnabled && !env.multiSiteEnabled) {
    return jsonError("Site editing is not enabled.", 404);
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid site ID.");
  const parsed = sitePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid site payload.");
  if (!Object.keys(parsed.data).length) return jsonError("No site changes supplied.");
  // Address and notes edits work on the existing schema. Changing primaries
  // still needs the multi-site migration's uniqueness constraint and trigger.
  if (parsed.data.is_primary !== undefined && !env.multiSiteEnabled) {
    return jsonError("Changing the primary site is not enabled.", 404);
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("sites")
    .update(parsed.data)
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .select("*")
    .maybeSingle();
  if (error) return siteWriteError(error);
  if (!data) return jsonError("Site not found.", 404);
  return jsonSuccess({ site: data });
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireCrmApiUser(["management", "admin"]);
  if ("error" in auth) return auth.error;
  if (!getCrmEnv().multiSiteEnabled) return jsonError("Site management is not enabled.", 404);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid site ID.");

  const { supabase, tenant } = auth.session;
  // The RPC locks the site and rejects linked jobs/contacts before deleting.
  const { data, error } = await supabase.schema("crm").rpc("delete_unused_site", {
    p_site_id: id,
    p_tenant_id: tenant.id,
  });
  if (error) return siteWriteError(error);
  if (!data) return jsonError("Site not found.", 404);
  return jsonSuccess({ site: data });
}
