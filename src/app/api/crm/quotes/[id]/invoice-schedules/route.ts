import { invoiceScheduleSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = normalizeBlankFields(await request.json(), ["percentage", "fixed_amount"]);
    const parsed = invoiceScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid invoice schedule payload.");
    }

    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("invoice_schedules")
      .insert({
        tenant_id: tenant.id,
        quote_id: id,
        label: parsed.data.label,
        payment_type: parsed.data.payment_type,
        percentage: parsed.data.percentage ?? null,
        fixed_amount: parsed.data.fixed_amount ?? null,
        due_offset_days: parsed.data.due_offset_days,
        status: "planned",
      })
      .select("*")
      .single();
    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonSuccess({ schedule: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create invoice schedule.", 400);
  }
}
