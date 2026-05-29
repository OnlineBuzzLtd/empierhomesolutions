import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAppointmentReminder24h } from "@/modules/crm/notifications/appointment-reminders";

export function mintSelfServiceToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSelfServiceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAppointmentSelfServiceToken(
  supabase: SupabaseClient,
  input: { tenantId: string; appointmentId: string; ttlDays?: number },
) {
  const token = mintSelfServiceToken();
  const expiresAt = new Date(Date.now() + (input.ttlDays ?? 14) * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.schema("crm").from("appointment_self_service_tokens").insert({
    tenant_id: input.tenantId,
    appointment_id: input.appointmentId,
    token_hash: hashSelfServiceToken(token),
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { token, expiresAt };
}

export async function getAppointmentForSelfServiceToken(supabase: SupabaseClient, token: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("appointment_self_service_tokens")
    .select(
      "id, tenant_id, appointment_id, expires_at, used_at, revoked_at, appointment:appointments(id, tenant_id, title, starts_at, ends_at, status, customer:customers(full_name, email, phone))",
    )
    .eq("token_hash", hashSelfServiceToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  const appointment = Array.isArray(data.appointment) ? data.appointment[0] : data.appointment;
  if (!appointment) {
    return null;
  }
  return { tokenRow: data, appointment };
}

export async function cancelSelfServiceAppointment(supabase: SupabaseClient, token: string) {
  const resolved = await getAppointmentForSelfServiceToken(supabase, token);
  if (!resolved) {
    return { ok: false, error: "invalid_token" as const };
  }
  const { appointment, tokenRow } = resolved;
  if (appointment.status === "cancelled") {
    return { ok: true, appointment, status: "already_cancelled" as const };
  }
  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment.id)
    .eq("tenant_id", tokenRow.tenant_id)
    .select("*")
    .single();
  if (error) throw error;
  await supabase
    .schema("crm")
    .from("appointment_self_service_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);
  return { ok: true, appointment: data, status: "cancelled" as const };
}

export async function rescheduleSelfServiceAppointment(
  supabase: SupabaseClient,
  input: { token: string; startsAt: string; endsAt: string },
) {
  const resolved = await getAppointmentForSelfServiceToken(supabase, input.token);
  if (!resolved) {
    return { ok: false, error: "invalid_token" as const };
  }
  const { appointment, tokenRow } = resolved;
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "invalid_time" as const };
  }

  const { data: conflicts, error: conflictError } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id")
    .eq("tenant_id", tokenRow.tenant_id)
    .neq("status", "cancelled")
    .neq("id", appointment.id)
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .limit(1);
  if (conflictError) throw conflictError;
  if ((conflicts ?? []).length > 0) {
    return { ok: false, error: "slot_unavailable" as const };
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({ starts_at: start.toISOString(), ends_at: end.toISOString(), status: "scheduled" })
    .eq("id", appointment.id)
    .eq("tenant_id", tokenRow.tenant_id)
    .select("*")
    .single();
  if (error) throw error;
  await supabase
    .schema("crm")
    .from("appointment_self_service_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);
  await syncAppointmentReminder24h(supabase, tokenRow.tenant_id, data);
  return { ok: true, appointment: data };
}
