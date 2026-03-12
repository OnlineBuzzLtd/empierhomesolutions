import { appointmentSchema } from "@/modules/crm/lib/validation";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { jsonError, jsonSuccess } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid appointment payload.");
  }

  const supabase = await createCrmServerClient();
  const { data, error } = await supabase.schema("crm").from("appointments").insert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ appointment: data });
}
