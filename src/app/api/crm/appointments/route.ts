import { appointmentSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { syncAppointmentReminder24h } from "@/modules/crm/notifications/appointment-reminders";
import { pushAppointmentToFsm } from "@/modules/crm/integrations/fsm/sync";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid appointment payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const { data, error } = await supabase.schema("crm").from("appointments").insert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  await syncAppointmentReminder24h(supabase, tenant.id, data);
  const fsm = await pushAppointmentToFsm(supabase, { tenantId: tenant.id, appointmentId: data.id }).catch((error) => ({
    pushed: false,
    warning: error instanceof Error ? error.message : "FSM push failed.",
  }));

  return jsonSuccess({ appointment: data, fsm });
}
