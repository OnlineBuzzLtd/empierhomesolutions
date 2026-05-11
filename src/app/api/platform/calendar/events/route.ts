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

  // Resolve the engineer's tenant_id from user_profiles so we satisfy
  // the unique index (tenant_id, source, external_id) and the
  // appointment's tenant_id NOT NULL constraint.
  const { data: engineer, error: engineerError } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("id, tenant_id, active")
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

  // Idempotent upsert. If an appointment with (source='platform',
  // external_id=bookingId) already exists for this tenant, return it
  // unchanged — second POST with the same bookingId is a no-op.
  const upsertPayload = {
    tenant_id: engineer.tenant_id,
    assigned_to: parsed.resourceRef,
    type: "booking" as const,
    title: parsed.summary?.slice(0, 200) ?? `Booking ${parsed.bookingId.slice(0, 8)}`,
    starts_at: parsed.startTime,
    ends_at: parsed.endTime,
    status: "scheduled" as const,
    source: "platform" as const,
    external_id: parsed.bookingId,
  };

  const { data: upserted, error: upsertError } = await supabase
    .schema("crm")
    .from("appointments")
    .upsert(upsertPayload, { onConflict: "tenant_id,source,external_id", ignoreDuplicates: false })
    .select("id")
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ providerReference: upserted.id });
}
