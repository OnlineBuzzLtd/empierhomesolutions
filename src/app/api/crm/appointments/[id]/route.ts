import { appointmentSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = appointmentSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid appointment payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("appointments").update(parsed.data).eq("id", id).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ appointment: data });
}
