import { quoteSchema } from "@/modules/crm/lib/validation";
import { computeFinancials, jsonError, jsonSuccess, nextQuoteNumber, parseLineItems } from "@/modules/crm/lib/api";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = quoteSchema.safeParse({
    ...body,
    line_items: parseLineItems(body.line_items),
  });
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid quote payload.");
  }

  const financials = computeFinancials(parsed.data.line_items, parsed.data.vat_rate);
  const payload = {
    ...parsed.data,
    ...financials,
    quote_number: await nextQuoteNumber(),
  };

  const supabase = await createCrmServerClient();
  const { data, error } = await supabase.schema("crm").from("quotes").insert(payload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ quote: data });
}
