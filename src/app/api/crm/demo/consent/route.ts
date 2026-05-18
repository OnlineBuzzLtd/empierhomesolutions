import { NextResponse } from "next/server";
import { z } from "zod";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";

// Demo Console consent capture (ticket E-2). The operator fills out the
// form with the prospect's name, phone, and the PECR-compliant consent
// text (which the form renders verbatim from a fixed copy block — see
// src/modules/crm/demo-console/operator/ConsentForm.tsx). This endpoint:
//
//   1. Closes any prior active session for the tenant (one-at-a-time).
//   2. Inserts a new demo_sessions row with the consent metadata.
//   3. Returns the session_id and started_at to drive the live pane +
//      cleanup window.
//
// PECR note: this endpoint is the legal anchor for outbound SMS / WA
// during the demo. The consent_text field stores the EXACT wording the
// prospect agreed to. Don't change ConsentForm.tsx copy without updating
// downstream paperwork.

const bodySchema = z.object({
  prospect_name: z.string().min(1).max(160),
  prospect_phone: z.string().min(5).max(40),
  consent_text: z.string().min(1).max(2000),
  consent_acknowledged: z.literal(true),
});

export async function POST(request: Request) {
  const guard = await guardDemoApi({ requireActiveSession: false });
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid consent payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { admin, tenantId, userId } = guard;

  // Close any prior active session for this tenant. One demo at a time.
  const { error: closeError } = await admin
    .schema("crm")
    .from("demo_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .is("ended_at", null);

  if (closeError) {
    return NextResponse.json(
      { error: "Failed to close prior session.", detail: closeError.message },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .schema("crm")
    .from("demo_sessions")
    .insert({
      tenant_id: tenantId,
      started_by: userId,
      prospect_name: parsed.data.prospect_name.trim(),
      prospect_phone: parsed.data.prospect_phone.trim(),
      consent_text: parsed.data.consent_text,
      consent_recorded_at: new Date().toISOString(),
    })
    .select("id, started_at, prospect_name, prospect_phone")
    .single<{ id: string; started_at: string; prospect_name: string; prospect_phone: string }>();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create demo session.", detail: error?.message ?? "no data" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    session_id: data.id,
    started_at: data.started_at,
    prospect_name: data.prospect_name,
    prospect_phone: data.prospect_phone,
  });
}
