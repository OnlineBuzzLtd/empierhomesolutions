import { quoteSchema } from "@/modules/crm/lib/validation";
import { computeFinancials, jsonError, jsonSuccess, normalizeBlankFields, parseLineItems, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { snapshotQuoteVersion } from "@/modules/crm/lib/quotes";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["valid_until", "change_summary"]);
    const parsed = quoteSchema.safeParse({
      ...body,
      line_items: parseLineItems(body.line_items),
    });
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid quote payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant, user } = auth.session;
    const { data: existing, error: existingError } = await supabase
      .schema("crm")
      .from("quotes")
      .select("id, current_version_number")
      .eq("id", id)
      .single();
    if (existingError || !existing) {
      return jsonError(existingError?.message ?? "Quote not found.", 404);
    }

    const financials = computeFinancials(parsed.data.line_items, parsed.data.vat_rate);
    const nextVersionNumber = Number(existing.current_version_number ?? 1) + 1;
    const { data, error } = await supabase
      .schema("crm")
      .from("quotes")
      .update({
        ...parsed.data,
        ...financials,
        current_version_number: nextVersionNumber,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }

    await snapshotQuoteVersion(supabase, {
      tenantId: tenant.id,
      quoteId: id,
      versionNumber: nextVersionNumber,
      documentType: parsed.data.document_type,
      lineItems: parsed.data.line_items,
      subtotal: financials.subtotal,
      vatRate: parsed.data.vat_rate,
      vatCategory: parsed.data.vat_category,
      total: financials.total,
      validUntil: parsed.data.valid_until ?? null,
      status: parsed.data.status,
      changeSummary: typeof body.change_summary === "string" ? body.change_summary : null,
      createdBy: resolveCreatedByUserId(user),
    });

    return jsonSuccess({ quote: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update quote.", 400);
  }
}
