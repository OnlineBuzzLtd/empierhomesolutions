// Phase I — POST /api/platform/calendar/events/:bookingId/confirm
//
// Transitions a hold to confirmed. Empire's appointment status enum
// is scheduled/completed/cancelled — a "scheduled" appointment is
// already blocking the slot, so confirmHold is mostly a no-op at the
// status level. We still treat it as a checkpoint:
//   - 404 if no such appointment exists for source='platform' +
//     external_id=bookingId.
//   - 409 if the appointment is cancelled (cannot confirm a released
//     hold — customer must re-book a fresh slot).
//   - 200 otherwise. Idempotent: a second confirm on a
//     scheduled/completed appointment is a no-op success.

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

type RouteContext = { params: Promise<{ bookingId: string }> };

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
  const { data: appointment, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id, status")
    .eq("source", "platform")
    .eq("external_id", bookingId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!appointment) {
    return NextResponse.json({ error: "event_not_found", message: `No platform appointment for bookingId ${bookingId}.` }, { status: 404 });
  }
  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "event_cancelled", message: "Cannot confirm — event was cancelled." }, { status: 409 });
  }

  // Already scheduled or completed → idempotent success.
  return NextResponse.json({ ok: true });
}
