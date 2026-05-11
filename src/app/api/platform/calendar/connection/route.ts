// Phase I — GET /api/platform/calendar/connection
//
// Health + identity check called by the platform side's
// CrmCalendarAdapter.validateConnection(). Returns the email the CRM
// represents + which scopes this deployment supports. Both `read`
// (availability) and `write` (hold/confirm/cancel) are supported.
//
// Auth: HMAC-SHA256 via x-platform-signature header. See
// docs/crm-calendar-contract.md in the platform repo.

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

export async function GET(request: Request) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  // GET has empty body; HMAC signature still covers `${timestamp}.`
  const auth = verifyPlatformRequest(request, "", env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    connectedAccountEmail: "calendar@empire-home-solutions.example",
    scopes: ["read", "write"],
  });
}
