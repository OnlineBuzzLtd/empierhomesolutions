export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyStaticSecret } from "@/modules/crm/intake/signatures";
import { processFsmCompletionWebhook } from "@/modules/crm/integrations/fsm/webhooks";

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!verifyStaticSecret({ configuredSecret: env.serviceM8WebhookSecret, providedSecret: request.headers.get("x-webhook-secret") })) {
    return NextResponse.json({ error: "Invalid ServiceM8 webhook secret." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const result = await processFsmCompletionWebhook(createCrmServiceRoleClient(), { provider: "servicem8", body });
  return NextResponse.json({ ok: true, ...result });
}
