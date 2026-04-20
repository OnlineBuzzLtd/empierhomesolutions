import { quoteSchema } from "@/modules/crm/lib/validation";
import { computeFinancials, jsonError, jsonSuccess, nextQuoteNumber, parseLineItems, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { snapshotQuoteVersion } from "@/modules/crm/lib/quotes";

export async function POST(request: Request) {
  try {
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = quoteSchema.safeParse({
      ...body,
      line_items: parseLineItems(body.line_items),
    });
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid quote payload.");
    }

    const financials = computeFinancials(parsed.data.line_items, parsed.data.vat_rate);
    const { supabase, tenant, user } = auth.session;
    const payload = {
      ...parsed.data,
      ...financials,
      quote_number: await nextQuoteNumber(),
      current_version_number: 1,
    };
    const { data, error } = await supabase.schema("crm").from("quotes").insert(payload).select("*").single();
    if (error) {
      return jsonError(error.message, 500);
    }

    await snapshotQuoteVersion(supabase, {
      tenantId: tenant.id,
      quoteId: data.id,
      versionNumber: 1,
      documentType: payload.document_type,
      lineItems: parsed.data.line_items,
      subtotal: financials.subtotal,
      vatRate: parsed.data.vat_rate,
      vatCategory: parsed.data.vat_category,
      total: financials.total,
      validUntil: parsed.data.valid_until ?? null,
      status: parsed.data.status,
      changeSummary: "Initial version",
      createdBy: resolveCreatedByUserId(user),
    });

    return jsonSuccess({ quote: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create quote.", 500);
  }
}
