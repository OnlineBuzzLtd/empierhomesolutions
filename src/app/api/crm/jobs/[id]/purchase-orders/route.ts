import { purchaseOrderSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["supplier_id", "notes", "issued_at"]);
    const parsed = purchaseOrderSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid purchase order payload.");
    const auth = await requireCrmApiUser();
    if ("error" in auth) return auth.error;
    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase.schema("crm").from("purchase_orders").insert({
      tenant_id: tenant.id,
      job_id: id,
      supplier_id: parsed.data.supplier_id ?? null,
      po_number: parsed.data.po_number,
      status: parsed.data.status,
      total_amount: parsed.data.total_amount,
      notes: parsed.data.notes ?? null,
      issued_at: parsed.data.issued_at ?? null,
    }).select("*, supplier:suppliers(id, name)").single();
    if (error) return jsonError(error.message, 500);
    return jsonSuccess({ purchaseOrder: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create purchase order.", 400);
  }
}
