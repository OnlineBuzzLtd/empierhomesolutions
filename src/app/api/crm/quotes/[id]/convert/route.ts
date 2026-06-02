import { addDays } from "date-fns";
import { jsonError, jsonSuccess, nextInvoiceNumber, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireCrmApiUser(["management", "admin", "sales", "accounts"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;

  const { data: quote, error: quoteError } = await supabase
    .schema("crm")
    .from("quotes")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .single();
  if (quoteError || !quote) {
    return jsonError(quoteError?.message ?? "Quote not found.", 404);
  }

  const invoicePayload = {
    tenant_id: tenant.id,
    quote_id: quote.id,
    job_id: quote.job_id,
    customer_id: quote.customer_id,
    invoice_number: await nextInvoiceNumber(),
    invoice_kind: "standard",
    balance_of_quote_id: quote.id,
    line_items: quote.line_items,
    subtotal: quote.subtotal,
    vat_rate: quote.vat_rate,
    vat_category: quote.vat_category,
    total: quote.total,
    status: "unpaid",
    due_date: addDays(new Date(), 14).toISOString().slice(0, 10),
    is_test: quote.is_test === true,
  };

  const { data: invoice, error } = await supabase.schema("crm").from("invoices").insert(invoicePayload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  await supabase.schema("crm").from("quotes").update({ status: "accepted" }).eq("tenant_id", tenant.id).eq("id", id);
  return jsonSuccess({ invoice });
}
