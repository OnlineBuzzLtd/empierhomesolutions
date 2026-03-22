import { productSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid product payload.");
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("products").upsert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ product: data });
}
