export const runtime = "nodejs";

import { renderInvoicePdf } from "@/modules/crm/lib/pdf";
import { getInvoiceDetail } from "@/modules/crm/lib/data";
import { requireCrmApiUser } from "@/modules/crm/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const invoiceDetail = await getInvoiceDetail(id);
  if (!invoiceDetail) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await renderInvoicePdf(invoiceDetail.invoice);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceDetail.invoice.invoice_number}.pdf"`,
    },
  });
}
