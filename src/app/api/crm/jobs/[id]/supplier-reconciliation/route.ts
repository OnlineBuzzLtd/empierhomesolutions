import { supplierReconciliationSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["purchase_order_id", "supplier_id", "reference_number"]);
    const parsed = supplierReconciliationSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid reconciliation payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase.schema("crm").from("supplier_reconciliation").insert({
      tenant_id: tenant.id,
      job_id: id,
      purchase_order_id: parsed.data.purchase_order_id ?? null,
      supplier_id: parsed.data.supplier_id ?? null,
      entry_type: parsed.data.entry_type,
      reference_number: parsed.data.reference_number ?? null,
      amount: parsed.data.amount,
      status: parsed.data.status,
    }).select("*, supplier:suppliers(id, name)").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ reconciliation: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create supplier reconciliation entry.", 400);
  }
}
