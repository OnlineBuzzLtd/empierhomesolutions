import type { SupabaseClient } from "@supabase/supabase-js";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";
import { cancelScheduledNotifications, scheduleNotification } from "@/modules/crm/notifications/scheduler";

type AppointmentReminderInput = {
  id: string;
  tenant_id?: string | null;
  customer_id?: string | null;
  type?: string | null;
  title?: string | null;
  starts_at?: string | null;
  status?: string | null;
  is_test?: boolean | null;
};

type CustomerContact = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

function reminderMetadata(appointmentId: string) {
  return { appointment_id: appointmentId };
}

function formatAppointmentTime(startsAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(startsAt));
}

async function loadCustomerContact(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string | null | undefined,
): Promise<CustomerContact | null> {
  if (!customerId) {
    return null;
  }
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .select("full_name, phone, email")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .maybeSingle<CustomerContact>();
  if (error) {
    throw error;
  }
  return data ?? null;
}

export async function cancelAppointmentReminder24h(
  supabase: SupabaseClient,
  input: { tenantId: string; appointmentId: string },
) {
  await cancelScheduledNotifications(supabase, {
    tenantId: input.tenantId,
    metadataMatch: reminderMetadata(input.appointmentId),
  });
}

async function scheduleSmsReminder(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    appointment: AppointmentReminderInput;
    customerPhone: string;
    dispatchAt: Date;
    templateKey: "reminder_24h_sms" | "reminder_2h_sms";
    reminderType: "24h" | "2h";
    variables: Record<string, unknown>;
  },
) {
  const rendered = await renderNotificationTemplate(supabase, {
    tenantId: input.tenantId,
    key: input.templateKey,
    channel: "sms",
    variables: input.variables,
  });
  await scheduleNotification(supabase, {
    tenantId: input.tenantId,
    recipient: input.customerPhone,
    channel: "sms",
    templateKey: rendered.template.key,
    payload: { body: rendered.body },
    dispatchAt: input.dispatchAt,
    idempotencyKey: `appointment:${input.appointment.id}:${input.templateKey}:${input.appointment.starts_at}`,
    isTest: input.appointment.is_test ?? false,
    metadata: { ...reminderMetadata(input.appointment.id), reminder_type: input.reminderType },
  });
}

export async function syncAppointmentReminders(
  supabase: SupabaseClient,
  tenantId: string,
  appointment: AppointmentReminderInput,
  options: { now?: Date } = {},
) {
  await cancelAppointmentReminder24h(supabase, { tenantId, appointmentId: appointment.id });

  if (appointment.type !== "booking" || appointment.status !== "scheduled" || !appointment.starts_at) {
    return { scheduled: 0, reason: "not_schedulable" as const };
  }

  const startsAt = new Date(appointment.starts_at);
  const dispatch24hAt = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  const dispatch2hAt = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
  const now = options.now ?? new Date();
  if (!Number.isFinite(startsAt.getTime()) || dispatch2hAt.getTime() <= now.getTime()) {
    return { scheduled: 0, reason: "dispatch_window_passed" as const };
  }

  const customer = await loadCustomerContact(supabase, tenantId, appointment.customer_id);
  if (!customer?.phone && !customer?.email) {
    return { scheduled: 0, reason: "no_contact" as const };
  }

  const variables = {
    customer_name: customer.full_name?.trim() || "there",
    service_name: appointment.title?.trim() || "your appointment",
    appointment_time: formatAppointmentTime(appointment.starts_at),
  };
  const metadata = reminderMetadata(appointment.id);
  let scheduled = 0;

  if (customer.phone) {
    if (dispatch24hAt.getTime() > now.getTime()) {
      await scheduleSmsReminder(supabase, {
        tenantId,
        appointment,
        customerPhone: customer.phone,
        dispatchAt: dispatch24hAt,
        templateKey: "reminder_24h_sms",
        reminderType: "24h",
        variables,
      });
      scheduled += 1;
    }
    await scheduleSmsReminder(supabase, {
      tenantId,
      appointment,
      customerPhone: customer.phone,
      dispatchAt: dispatch2hAt,
      templateKey: "reminder_2h_sms",
      reminderType: "2h",
      variables,
    });
    scheduled += 1;
  }

  if (customer.email && dispatch24hAt.getTime() > now.getTime()) {
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId,
      key: "reminder_24h_email",
      channel: "email",
      variables,
    });
    await scheduleNotification(supabase, {
      tenantId,
      recipient: customer.email,
      channel: "email",
      templateKey: rendered.template.key,
      payload: { subject: rendered.subject, html: rendered.body },
      dispatchAt: dispatch24hAt,
      idempotencyKey: `appointment:${appointment.id}:reminder_24h_email:${appointment.starts_at}`,
      isTest: appointment.is_test ?? false,
      metadata: { ...metadata, reminder_type: "24h" },
    });
    scheduled += 1;
  }

  return { scheduled, reason: "scheduled" as const };
}

export const syncAppointmentReminder24h = syncAppointmentReminders;
