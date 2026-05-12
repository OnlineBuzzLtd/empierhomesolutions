// Phase I — POST /api/platform/calendar/events/:eventId/confirm
//
// Transitions a hold to confirmed. Empire's appointment status enum
// is scheduled/completed/cancelled — a "scheduled" appointment is
// already blocking the slot, so confirmHold is mostly a no-op at the
// status level. We still treat it as a checkpoint:
//   - 404 if no such appointment exists for source='platform' +
//     external_id=bookingId OR id=providerReference.
//   - 409 if the appointment is cancelled (cannot confirm a released
//     hold — customer must re-book a fresh slot).
//   - 200 otherwise. Idempotent: a second confirm on a
//     scheduled/completed appointment is a no-op success.
//
// Backwards compatibility: older platform callers used bookingId in
// the path. Current CalendarAdapter callers pass providerReference
// (the appointment row id returned by createHold). Accept both.

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

export async function POST(request: Request, context: RouteContext) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const auth = verifyPlatformRequest(request, rawBody, env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { bookingId } = await context.params;
  if (!bookingId || bookingId.length === 0) {
    return NextResponse.json({ error: "invalid_booking_id" }, { status: 400 });
  }

  const supabase = createCrmServiceRoleClient();
  const { data: appointment, error, matchedBy } = await findPlatformAppointment(supabase, bookingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!appointment) {
    return NextResponse.json({ error: "event_not_found", message: `No platform appointment for bookingId ${bookingId}.` }, { status: 404 });
  }
  console.info("[platform-calendar] confirm resolved", {
    eventId: bookingId,
    matchedBy,
    appointmentId: appointment.id,
    status: appointment.status,
  });
  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "event_cancelled", message: "Cannot confirm — event was cancelled." }, { status: 409 });
  }

  // Already scheduled or completed → idempotent success.
  return NextResponse.json({ ok: true });
}
