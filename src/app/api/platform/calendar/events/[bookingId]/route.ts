// Phase I — DELETE + GET /api/platform/calendar/events/:eventId
//
// DELETE: cancelHold. Sets status='cancelled' on the platform-sourced
//   appointment. Idempotent — DELETE on an unknown bookingId returns
//   200 (the platform treats "already gone" as success).
//
// GET: lookupEvent. Returns the current status mapped to the
//   platform's enum ("hold" | "confirmed" | "cancelled" | "completed").
//
// Backwards compatibility: older platform callers used bookingId in
// the path (appointments.external_id). Current CalendarAdapter callers
// pass providerReference (appointments.id). Accept both, scoped to
// source='platform'.

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

type RouteContext = { params: Promise<{ bookingId: string }> };

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function findPlatformAppointment(
  supabase: ReturnType<typeof createCrmServiceRoleClient>,
  eventId: string,
) {
  const byBookingId = await supabase
    .schema("crm")
    .from("appointments")
    .select("id, status, external_id")
    .eq("source", "platform")
    .eq("external_id", eventId)
    .maybeSingle();

  if (byBookingId.error || byBookingId.data || !isUuidLike(eventId)) {
    return {
      data: byBookingId.data,
      error: byBookingId.error,
      matchedBy: byBookingId.data ? "bookingId" : null,
    } as const;
  }

  const byProviderReference = await supabase
    .schema("crm")
    .from("appointments")
    .select("id, status, external_id")
    .eq("source", "platform")
    .eq("id", eventId)
    .maybeSingle();

  return {
    data: byProviderReference.data,
    error: byProviderReference.error,
    matchedBy: byProviderReference.data ? "providerReference" : null,
  } as const;
}

export async function DELETE(request: Request, context: RouteContext) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const auth = verifyPlatformRequest(request, "", env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { bookingId } = await context.params;
  if (!bookingId) {
    return NextResponse.json({ error: "invalid_booking_id" }, { status: 400 });
  }

  const supabase = createCrmServiceRoleClient();
  const { data: appointment, error: lookupError, matchedBy } = await findPlatformAppointment(supabase, bookingId);
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!appointment) {
    // Idempotent — if no row matched, the platform still gets 200.
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("source", "platform")
    .eq("id", appointment.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.info("[platform-calendar] cancel resolved", {
    eventId: bookingId,
    matchedBy,
    appointmentId: appointment.id,
    previousStatus: appointment.status,
  });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, context: RouteContext) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const auth = verifyPlatformRequest(request, "", env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { bookingId } = await context.params;
  if (!bookingId) {
    return NextResponse.json({ error: "invalid_booking_id" }, { status: 400 });
  }

  const supabase = createCrmServiceRoleClient();
  const { data, error, matchedBy } = await findPlatformAppointment(supabase, bookingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ exists: false, status: null });
  }
  console.info("[platform-calendar] lookup resolved", {
    eventId: bookingId,
    matchedBy,
    appointmentId: data.id,
    status: data.status,
  });
  // Empire's enum is scheduled/completed/cancelled. The platform's
  // contract uses hold/confirmed/cancelled/completed. We map
  // scheduled → "confirmed" (the appointment is locked in once the
  // hold is created here, since Empire doesn't distinguish further).
  const mapped =
    data.status === "scheduled"
      ? "confirmed"
      : data.status === "completed"
        ? "completed"
        : data.status === "cancelled"
          ? "cancelled"
          : data.status;
  return NextResponse.json({ exists: true, status: mapped });
}
