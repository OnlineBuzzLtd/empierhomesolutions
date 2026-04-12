import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { publishPendingPlatformOutboxEvents } from "@/modules/platform/lib/outbox";

function getSharedSecret(request: Request) {
  return request.headers.get("x-platform-shared-secret")?.trim() ?? "";
}

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  if (getSharedSecret(request) !== env.platformSharedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createCrmServiceRoleClient();
    const result = await publishPendingPlatformOutboxEvents(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to publish platform outbox events.",
      },
      { status: 500 },
    );
  }
}
