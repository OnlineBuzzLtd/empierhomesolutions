import { NextResponse } from "next/server";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";

// Demo Console kill switch (ticket E-6). Sets crm.tenant_settings.demo_kill_switch_at
// for the active tenant. Effect:
//   - The Demo Console UI polls this column (via the active-session
//     endpoint or directly) and disables trigger buttons while it's
//     set within the last 24h.
//   - The platform-api (separate repo, ticket G-1) reads the column
//     before any Twilio outbound for the tenant; halts sends when set.
//
// Until G-1 ships, this endpoint stops NEW BookingConfirmed events
// from arriving (since the operator can't push triggers) but does NOT
// stop in-flight outbound. The button copy makes that explicit.
//
// POST { clear: true } resets the flag (used when the operator is
// ready to demo again after a Twilio incident has been investigated).

export async function POST(request: Request) {
  const guard = await guardDemoApi({ requireActiveSession: false });
  if (!guard.ok) return guard.response;

  const { admin, tenantId } = guard;

  let body: { clear?: boolean } = {};
  try {
    body = (await request.json()) as { clear?: boolean };
  } catch {
    // Empty body means "set the kill switch now".
    body = {};
  }

  const newValue = body.clear === true ? null : new Date().toISOString();

  const { error } = await admin
    .schema("crm")
    .from("tenant_settings")
    .update({ demo_kill_switch_at: newValue })
    .eq("tenant_id", tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    demo_kill_switch_at: newValue,
  });
}
