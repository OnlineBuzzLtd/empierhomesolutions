import { purchaseOrderSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; poId: string }> }) {
  try {
    const { id, poId } = await params;
    const body = normalizeBlankFields(await request.json(), ["supplier_id", "notes", "issued_at"]);
    const parsed = purchaseOrderSchema.partial().safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid purchase order payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase } = auth.session;
    const { data, error } = await supabase.schema("crm").from("purchase_orders").update(parsed.data).eq("job_id", id).eq("id", poId).select("*, supplier:suppliers(id, name)").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ purchaseOrder: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update purchase order.", 400);
  }
}
