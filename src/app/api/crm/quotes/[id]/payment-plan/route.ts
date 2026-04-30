import { paymentPlanSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { buildScheduleRows } from "@/modules/crm/lib/payment-plan";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const parsed = paymentPlanSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid payment plan payload.");
    }

    const { supabase, tenant } = auth.session;
    const { data: quote, error: quoteErr } = await supabase
      .schema("crm")
      .from("quotes")
      .select("id, total")
      .eq("id", id)
      .maybeSingle();
    if (quoteErr || !quote) {
      return jsonError(quoteErr?.message ?? "Quote not found.", 404);
    }

    const totalAmount = Number(quote.total ?? 0);
    const rows = buildScheduleRows(parsed.data, totalAmount);

    // Idempotent: replace draft schedules only. Never touch invoiced/paid rows.
    const { error: delErr } = await supabase
      .schema("crm")
      .from("invoice_schedules")
      .delete()
      .eq("quote_id", id)
      .eq("status", "planned");
    if (delErr) {
      return jsonError(delErr.message, 500);
    }

    if (rows.length > 0) {
      const insertPayload = rows.map((row) => ({
        tenant_id: tenant.id,
        quote_id: id,
        label: row.label,
        payment_type: row.payment_type,
        percentage: row.percentage,
        fixed_amount: row.fixed_amount,
        due_offset_days: row.due_offset_days,
        status: "planned",
      }));
      const { error: insErr } = await supabase.schema("crm").from("invoice_schedules").insert(insertPayload);
      if (insErr) {
        return jsonError(insErr.message, 500);
      }
    }

    const { data: schedules } = await supabase
      .schema("crm")
      .from("invoice_schedules")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: true });

    return jsonSuccess({ schedules: schedules ?? [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save payment plan.", 500);
  }
}
