import { quoteAcceptanceSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";
import { snapshotQuoteVersion } from "@/modules/crm/lib/quotes";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["accepted_by_email", "notes"]);
    const parsed = quoteAcceptanceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid acceptance payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant, user } = auth.session;
    const { data: existing, error: existingError } = await supabase.schema("crm").from("quotes").select("*").eq("id", id).single();
    if (existingError || !existing) {
      return jsonError(existingError?.message ?? "Quote not found.", 404);
    }

    const acceptedAt = new Date().toISOString();
    const nextVersionNumber = Number(existing.current_version_number ?? 1) + 1;
    const [{ data: quote, error: quoteError }, { data: acceptance, error: acceptanceError }] = await Promise.all([
      supabase
        .schema("crm")
        .from("quotes")
        .update({ status: "accepted", current_version_number: nextVersionNumber })
        .eq("id", id)
        .select("*")
        .single(),
      supabase
        .schema("crm")
        .from("quote_acceptances")
        .upsert({
          tenant_id: tenant.id,
          quote_id: id,
          accepted_by_name: parsed.data.accepted_by_name,
          accepted_by_email: parsed.data.accepted_by_email ?? null,
          acceptance_method: parsed.data.acceptance_method,
          notes: parsed.data.notes ?? null,
          accepted_at: acceptedAt,
        }, { onConflict: "quote_id" })
        .select("*")
        .single(),
    ]);
    if (quoteError) {
      return jsonError(quoteError.message, 500);
    }
    if (acceptanceError) {
      return jsonError(acceptanceError.message, 500);
    }

    await snapshotQuoteVersion(supabase, {
      tenantId: tenant.id,
      quoteId: id,
      versionNumber: nextVersionNumber,
      documentType: quote.document_type,
      lineItems: quote.line_items,
      subtotal: Number(quote.subtotal),
      vatRate: Number(quote.vat_rate),
      vatCategory: quote.vat_category,
      total: Number(quote.total),
      validUntil: quote.valid_until,
      status: "accepted",
      changeSummary: "Customer accepted quote",
      createdBy: user.id,
    });

    return jsonSuccess({ quote, acceptance });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to record acceptance.", 400);
  }
}
