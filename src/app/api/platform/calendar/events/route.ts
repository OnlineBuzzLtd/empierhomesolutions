// Phase I — POST /api/platform/calendar/events  (createHold)
//
// Idempotent UPSERT on (source='platform', external_id=bookingId).
// The crm.appointments table already has source + external_id columns
// from migration 202604200001_crm_appointments_platform_source.sql,
// with a unique index on (tenant_id, source, external_id) that the
// upsert relies on for idempotency.
//
// Mapping platform concepts → Empire appointments:
//   resourceRef → assigned_to (engineer user_profile.id)
//   bookingId   → external_id, with source='platform'
//   startTime   → starts_at
//   endTime     → ends_at
//   summary     → title
//   status      → "scheduled" (Empire has no "hold" status; a platform
//                 hold maps to a scheduled appointment, blocking other
//                 customers from being offered the same slot until
//                 cancelled).
//
// Returns providerReference = the appointment row's id (UUID) — the
// platform stores this for later lookupEvent calls.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

const requestSchema = z.object({
  resourceRef: z.string().min(1),
  bookingId: z.string().min(1),
  leadId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  summary: z.string().optional(),
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

  const supabase = createCrmServiceRoleClient();

  // Resolve the engineer profile. The platform passes resourceRef =
  // crm.user_profiles.id (stable business identifier returned from the
  // /resources endpoint). For the appointment row we need user_id
  // (auth.users.id) because crm.appointments.assigned_to FKs auth.users —
  // crm.user_profiles.id is NOT the auth identity, just the profile row's
  // primary key.
  const { data: engineer, error: engineerError } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("id, user_id, tenant_id, active")
    .eq("id", parsed.resourceRef)
    .maybeSingle();

  if (engineerError) {
    return NextResponse.json({ error: engineerError.message }, { status: 500 });
  }
  if (!engineer) {
    return NextResponse.json({ error: "invalid_resource_ref", message: `Unknown engineer ${parsed.resourceRef}.` }, { status: 400 });
  }
  if (!engineer.active) {
    return NextResponse.json({ error: "resource_inactive", message: "Engineer is no longer active." }, { status: 409 });
  }

  // Idempotent find-or-create. The crm.appointments uniqueness on
  // (tenant_id, source, external_id) is enforced by a PARTIAL index
  // (WHERE external_id IS NOT NULL), which Postgres's ON CONFLICT
  // column-list syntax can't bind to — supabase-js's `.upsert()` falls
  // through to "no unique constraint" 42P10. We do the find/insert/update
  // explicitly so the route stays idempotent without changing the index.
  const basePayload = {
    tenant_id: engineer.tenant_id,
    assigned_to: engineer.user_id,
    type: "booking" as const,
    title: parsed.summary?.slice(0, 200) ?? `Booking ${parsed.bookingId.slice(0, 8)}`,
    starts_at: parsed.startTime,
    ends_at: parsed.endTime,
    status: "scheduled" as const,
  };

  const { data: existing, error: lookupError } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id")
    .eq("tenant_id", engineer.tenant_id)
    .eq("source", "platform")
    .eq("external_id", parsed.bookingId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (existing) {
    const { error: updateError } = await supabase
      .schema("crm")
      .from("appointments")
      .update(basePayload)
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ providerReference: existing.id });
  }

  const { data: inserted, error: insertError } = await supabase
    .schema("crm")
    .from("appointments")
    .insert({
      ...basePayload,
      source: "platform" as const,
      external_id: parsed.bookingId,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ providerReference: inserted.id });
}
