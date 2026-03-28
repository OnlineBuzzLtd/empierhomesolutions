import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { snapshotQuoteVersion } from "@/modules/crm/lib/quotes";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant, user } = auth.session;
    const { data: existing, error: existingError } = await supabase.schema("crm").from("quotes").select("*").eq("id", id).single();
    if (existingError || !existing) {
      return jsonError(existingError?.message ?? "Quote not found.", 404);
    }

    const nextVersionNumber = Number(existing.current_version_number ?? 1) + 1;
    const { data, error } = await supabase
      .schema("crm")
      .from("quotes")
      .update({ status: "sent", current_version_number: nextVersionNumber })
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
      documentType: data.document_type,
      lineItems: data.line_items,
      subtotal: Number(data.subtotal),
      vatRate: Number(data.vat_rate),
      vatCategory: data.vat_category,
      total: Number(data.total),
      validUntil: data.valid_until,
      status: "sent",
      changeSummary: "Quote sent to customer",
      createdBy: user.id,
    });

    return jsonSuccess({ quote: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to send quote.", 400);
  }
}
