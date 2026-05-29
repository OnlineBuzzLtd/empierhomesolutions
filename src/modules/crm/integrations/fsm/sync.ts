import type { SupabaseClient } from "@supabase/supabase-js";
import { getFsmAdapter, type FsmProviderKey, type FsmJobPayload } from "@/modules/crm/integrations/fsm/registry";

type AppointmentRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  job_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  external_fsm_id: string | null;
  external_fsm_provider: string | null;
  customer?: FsmJobPayload["customer"] | FsmJobPayload["customer"][];
  job?: FsmJobPayload["job"] | FsmJobPayload["job"][];
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function pushAppointmentToFsm(
  supabase: SupabaseClient,
  input: { tenantId: string; appointmentId: string },
) {
  const { data: settings, error: settingsError } = await supabase
    .schema("crm")
    .from("tenant_settings")
    .select("fsm_provider, fsm_config")
    .eq("tenant_id", input.tenantId)
    .maybeSingle<{ fsm_provider: FsmProviderKey; fsm_config: Record<string, unknown> | null }>();
  if (settingsError) throw settingsError;
  const provider = settings?.fsm_provider ?? "none";
  if (provider === "none") {
    return { pushed: false, skipped: "fsm_not_configured" };
  }

  const adapter = getFsmAdapter(provider);
  if (!adapter.pushJob) {
    return { pushed: false, skipped: "adapter_does_not_support_push" };
  }
  const config = settings?.fsm_config ?? {};
  if (!adapter.isConfigured(config)) {
    return { pushed: false, skipped: "fsm_config_incomplete" };
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select(
      "id, tenant_id, customer_id, job_id, title, starts_at, ends_at, external_fsm_id, external_fsm_provider, customer:customers(id, full_name, phone, email, address_line1, address_line2, city, postcode), job:jobs(id, title, description)",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.appointmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { pushed: false, skipped: "appointment_not_found" };
  }
  const appointment = data as unknown as AppointmentRow;
  if (appointment.external_fsm_id && appointment.external_fsm_provider === provider) {
    return { pushed: false, skipped: "already_pushed", externalId: appointment.external_fsm_id };
  }

  const result = await adapter.pushJob({
    tenantId: input.tenantId,
    appointmentId: input.appointmentId,
    jobId: appointment.job_id,
    config,
    payload: {
      appointment: {
        id: appointment.id,
        title: appointment.title,
        starts_at: appointment.starts_at,
        ends_at: appointment.ends_at,
        external_fsm_id: appointment.external_fsm_id,
      },
      customer: firstRelation(appointment.customer),
      job: firstRelation(appointment.job),
    },
  });

  if (result.ok && result.externalId) {
    const { error: updateError } = await supabase
      .schema("crm")
      .from("appointments")
      .update({ external_fsm_provider: provider, external_fsm_id: result.externalId })
      .eq("id", appointment.id);
    if (updateError) throw updateError;
  }

  return { pushed: result.ok, externalId: result.externalId ?? null, warning: result.warning ?? null };
}
