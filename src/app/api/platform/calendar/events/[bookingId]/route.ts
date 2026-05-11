// Phase I — DELETE + GET /api/platform/calendar/events/:bookingId
//
// DELETE: cancelHold. Sets status='cancelled' on the platform-sourced
//   appointment. Idempotent — DELETE on an unknown bookingId returns
//   200 (the platform treats "already gone" as success).
//
// GET: lookupEvent. Returns the current status mapped to the
//   platform's enum ("hold" | "confirmed" | "cancelled" | "completed").
//   The route param is the bookingId (NOT the providerReference) for
//   symmetry with confirm/cancel — Empire stores both, the platform
//   only knows the bookingId.

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

type RouteContext = { params: Promise<{ bookingId: string }> };

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
  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("source", "platform")
    .eq("external_id", bookingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Idempotent — if no rows matched, the platform still gets 200.
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
  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select("status")
    .eq("source", "platform")
    .eq("external_id", bookingId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ exists: false, status: null });
  }
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
