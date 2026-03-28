import { supplierReconciliationSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  try {
    const { id, entryId } = await params;
    const body = normalizeBlankFields(await request.json(), ["purchase_order_id", "supplier_id", "reference_number"]);
    const parsed = supplierReconciliationSchema.partial().safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid reconciliation payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase } = auth.session;
    const { data, error } = await supabase.schema("crm").from("supplier_reconciliation").update(parsed.data).eq("job_id", id).eq("id", entryId).select("*, supplier:suppliers(id, name)").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ reconciliation: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update supplier reconciliation entry.", 400);
  }
}
