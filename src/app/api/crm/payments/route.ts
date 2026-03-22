import { paymentSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payment payload.");
  }

  const payload = {
    ...parsed.data,
    requested_at: parsed.data.requested_at ?? new Date().toISOString(),
    received_at: parsed.data.status === "received" ? parsed.data.received_at ?? new Date().toISOString() : parsed.data.received_at,
  };

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("payments").insert(payload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ payment: data });
}
