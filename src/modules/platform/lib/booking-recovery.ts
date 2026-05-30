import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectBookingIdentityConflict,
  normalizeBookingEmail,
  normalizeBookingPhone,
  type BookingCustomerIdentity,
  type BookingCustomerMatch,
} from "@/modules/platform/lib/booking-identity";

type BookingEventRow = {
  event_id: string;
  tenant_id: string;
  payload: Record<string, unknown>;
  processing_status: string;
  occurred_at: string;
  last_error: string | null;
};

type BookingAppointmentRow = {
  id: string;
  external_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_id: string | null;
  lead_id: string | null;
  job_id: string | null;
};

export type BookingRecoveryCase = {
  id: string;
  eventId: string | null;
  appointmentId: string | null;
  bookingId: string | null;
  channel: string | null;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  service: string | null;
  startsAt: string | null;
  endsAt: string | null;
  reason: string;
  conflictingCustomerId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function customerIdentityFromPayload(payload: Record<string, unknown>): BookingCustomerIdentity {
  return {
    name: pickString(payload, ["customerName", "customer_full_name", "full_name"]),
    phone: pickString(payload, ["customerPhone", "customer_phone", "identity_phone", "from"]),
    email: pickString(payload, ["customerEmail", "customer_email", "identity_email"]),
    addressLine1: pickString(payload, ["serviceAddressLine1", "service_address_line1", "address_line1", "customer_address"]),
    city: pickString(payload, ["serviceCity", "service_city", "city"]),
    postcode: pickString(payload, ["servicePostcode", "customer_postcode", "postcode"]),
  };
}

function bookingIdFromPayload(payload: Record<string, unknown>) {
  return pickString(payload, ["booking_id", "booking_uid", "calcom_booking_id"]);
}

function findCustomerMatch(customers: BookingCustomerMatch[], identity: BookingCustomerIdentity) {
  const email = normalizeBookingEmail(identity.email);
  const phone = normalizeBookingPhone(identity.phone);
  if (email) {
    const match = customers.find((customer) => normalizeBookingEmail(customer.email) === email);
    if (match) return match;
  }
  if (phone) {
    const match = customers.find((customer) => normalizeBookingPhone(customer.phone) === phone);
    if (match) return match;
  }
  return null;
}

function buildReason(input: {
  event: BookingEventRow | null;
  appointment: BookingAppointmentRow | null;
  conflictReason: string | null;
}) {
  if (input.conflictReason) {
    return input.conflictReason;
  }
  if (input.appointment && (!input.appointment.customer_id || !input.appointment.lead_id || !input.appointment.job_id)) {
    return "Booking is on Scheduler but is not linked to a customer, enquiry, and job.";
  }
  return input.event?.last_error ?? "Booking needs review before it can be linked into the CRM.";
}

export async function listBookingRecoveryCases(supabase: SupabaseClient, tenantId: string) {
  const [eventsResult, customersResult, orphanAppointmentsResult] = await Promise.all([
    supabase
      .schema("crm")
      .from("platform_event_log")
      .select("event_id, tenant_id, payload, processing_status, occurred_at, last_error")
      .eq("tenant_id", tenantId)
      .eq("event_type", "BookingConfirmed")
      .order("occurred_at", { ascending: false })
      .limit(100)
      .returns<BookingEventRow[]>(),
    supabase
      .schema("crm")
      .from("customers")
      .select("id, full_name, phone, email, address_line1, postcode")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .returns<BookingCustomerMatch[]>(),
    supabase
      .schema("crm")
      .from("appointments")
      .select("id, external_id, title, starts_at, ends_at, status, customer_id, lead_id, job_id")
      .eq("tenant_id", tenantId)
      .eq("source", "platform")
      .not("external_id", "is", null)
      .or("customer_id.is.null,lead_id.is.null,job_id.is.null")
      .order("starts_at", { ascending: false })
      .limit(100)
      .returns<BookingAppointmentRow[]>(),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (customersResult.error) throw customersResult.error;
  if (orphanAppointmentsResult.error) throw orphanAppointmentsResult.error;

  const events = eventsResult.data ?? [];
  const ignoredBookingIds = new Set(
    events
      .filter((event) => event.processing_status === "ignored")
      .map((event) => bookingIdFromPayload(event.payload))
      .filter((value): value is string => Boolean(value)),
  );
  const customers = customersResult.data ?? [];
  const orphanAppointments = orphanAppointmentsResult.data ?? [];
  const externalIds = [...new Set(events.map((event) => bookingIdFromPayload(event.payload)).filter((value): value is string => Boolean(value)))];
  const appointmentLookupResult =
    externalIds.length === 0
      ? { data: [] as BookingAppointmentRow[], error: null }
      : await supabase
          .schema("crm")
          .from("appointments")
          .select("id, external_id, title, starts_at, ends_at, status, customer_id, lead_id, job_id")
          .eq("tenant_id", tenantId)
          .eq("source", "platform")
          .in("external_id", externalIds)
          .returns<BookingAppointmentRow[]>();

  if (appointmentLookupResult.error) throw appointmentLookupResult.error;

  const appointmentsByExternalId = new Map((appointmentLookupResult.data ?? []).map((appointment) => [appointment.external_id, appointment]));
  const cases = new Map<string, BookingRecoveryCase>();

  for (const event of events) {
    if (event.processing_status === "ignored") {
      continue;
    }
    const payload = asRecord(event.payload);
    const bookingId = bookingIdFromPayload(payload);
    const appointment = bookingId ? appointmentsByExternalId.get(bookingId) ?? null : null;
    const resolved = appointment?.customer_id && appointment.lead_id && appointment.job_id;
    if (resolved && event.processing_status !== "failed") {
      continue;
    }

    const identity = customerIdentityFromPayload(payload);
    const customerMatch = findCustomerMatch(customers, identity);
    const conflict = customerMatch ? detectBookingIdentityConflict(customerMatch, identity) : null;
    const id = event.event_id;
    cases.set(id, {
      id,
      eventId: event.event_id,
      appointmentId: appointment?.id ?? null,
      bookingId,
      channel: pickString(payload, ["channel", "response_channel", "source_channel"]),
      customerName: identity.name,
      phone: identity.phone,
      email: identity.email,
      address: identity.addressLine1,
      postcode: identity.postcode,
      service: pickString(payload, ["booking_title", "service_name", "service_key", "serviceCategory", "treatmentType"]),
      startsAt: pickString(payload, ["booking_start_at", "starts_at"]) ?? appointment?.starts_at ?? null,
      endsAt: pickString(payload, ["booking_end_at", "ends_at"]) ?? appointment?.ends_at ?? null,
      reason: buildReason({ event, appointment, conflictReason: conflict?.reason ?? null }),
      conflictingCustomerId: conflict?.conflictingCustomerId ?? null,
    });
  }

  for (const appointment of orphanAppointments) {
    if (appointment.external_id && ignoredBookingIds.has(appointment.external_id)) {
      continue;
    }
    const id = appointment.external_id ? `appointment:${appointment.external_id}` : `appointment:${appointment.id}`;
    if (cases.has(id) || [...cases.values()].some((item) => item.appointmentId === appointment.id)) {
      continue;
    }
    cases.set(id, {
      id,
      eventId: null,
      appointmentId: appointment.id,
      bookingId: appointment.external_id,
      channel: null,
      customerName: null,
      phone: null,
      email: null,
      address: null,
      postcode: null,
      service: appointment.title,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      reason: buildReason({ event: null, appointment, conflictReason: null }),
      conflictingCustomerId: null,
    });
  }

  return [...cases.values()];
}
