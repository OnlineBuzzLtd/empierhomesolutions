// Phase I — POST /api/platform/calendar/check-availability
//
// The hot path. Called once per candidate slot during a booking
// conversation, so latency matters.
//
// Logic: an engineer's resourceRef is unavailable for [startTime, endTime]
// if there is ANY non-cancelled appointment whose [starts_at, ends_at)
// overlaps the window AND is assigned_to that engineer. Both
// "scheduled" holds and "scheduled" confirmed bookings block the slot;
// only "cancelled" rows are ignored.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

const requestSchema = z.object({
  resourceRef: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const auth = verifyPlatformRequest(request, rawBody, env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    const json = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    const result = requestSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: "invalid_request", message: result.error.issues[0]?.message }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Body is not valid JSON." }, { status: 400 });
  }

  const startDate = new Date(parsed.startTime);
  const endDate = new Date(parsed.endTime);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "invalid_time", message: "startTime/endTime must be ISO 8601." }, { status: 400 });
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: "invalid_time", message: "endTime must be after startTime." }, { status: 400 });
  }

  const supabase = createCrmServiceRoleClient();
  // Overlap predicate: existing.starts_at < requested.endTime AND existing.ends_at > requested.startTime.
  const { data, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id")
    .eq("assigned_to", parsed.resourceRef)
    .neq("status", "cancelled")
    // CAL-003: ignore test-flagged appointments so mock-adapter validation
    // runs (MESSAGING_ADAPTER=mock on platform-api) never block real
    // customer availability. Migration 202605130001 adds the column;
    // default false on all existing rows.
    .eq("is_test", false)
    .lt("starts_at", parsed.endTime)
    .gt("ends_at", parsed.startTime)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ available: (data ?? []).length === 0 });
}
