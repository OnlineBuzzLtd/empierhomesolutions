export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyGoCardlessWebhookSignature } from "@/modules/crm/integrations/payments/payment-links";
import { processGoCardlessWebhookEvents } from "@/modules/crm/integrations/payments/webhook-processing";

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.gocardlessWebhookSecret) {
    return NextResponse.json({ error: "GoCardless webhook secret is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyGoCardlessWebhookSignature(rawBody, request.headers.get("webhook-signature"), env.gocardlessWebhookSecret)) {
    return NextResponse.json({ error: "Invalid GoCardless signature." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await processGoCardlessWebhookEvents(createCrmServiceRoleClient(), body);
  return NextResponse.json({ ok: true, ...result });
}
