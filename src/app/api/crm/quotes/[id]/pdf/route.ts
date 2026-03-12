export const runtime = "nodejs";

import { renderQuotePdf } from "@/modules/crm/lib/pdf";
import { getQuoteDetail } from "@/modules/crm/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteDetail(id);
  if (!quote) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await renderQuotePdf(quote);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quote_number}.pdf"`,
    },
  });
}
