import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { platformEventEnvelopeSchema } from "@/modules/platform/contracts";
import { processPlatformEvent } from "@/modules/platform/lib/processor";

function getSharedSecret(request: Request) {
  return request.headers.get("x-platform-shared-secret")?.trim() ?? "";
}

export async function POST(request: Request) {
  const env = getCrmEnv();
  const configuredSecret = env.platformSharedSecret;

  if (!configuredSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  if (getSharedSecret(request) !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = platformEventEnvelopeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid platform event payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createCrmServiceRoleClient();

  try {
    const result = await processPlatformEvent(supabase, parsed.data);
    if (!result.alias) {
      return NextResponse.json({ error: "Workspace alias not found." }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, commands_enqueued: result.commandsEnqueued, deferred: result.deferred ?? false },
      { status: result.deferred ? 202 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process platform event." },
      { status: 500 },
    );
  }
}
