import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { cancelInvoiceChaseSequence } from "@/modules/crm/notifications/invoice-chase";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase
    .schema("crm")
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  await supabase.schema("crm").from("invoice_schedules").update({ status: "paid" }).eq("invoice_id", id);
  const tenantId = tenant?.id ?? (typeof data?.tenant_id === "string" ? data.tenant_id : null);
  if (tenantId) {
    await cancelInvoiceChaseSequence(supabase, { tenantId, invoiceId: id });
  }

  return jsonSuccess({ invoice: data });
}
