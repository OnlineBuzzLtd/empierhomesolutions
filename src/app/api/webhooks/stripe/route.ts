export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyStripeWebhookSignature } from "@/modules/crm/integrations/payments/payment-links";
import { processStripeWebhookEvent } from "@/modules/crm/integrations/payments/webhook-processing";

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.stripeWebhookSecret) {
    return NextResponse.json({ error: "Stripe webhook secret is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyStripeWebhookSignature(rawBody, request.headers.get("stripe-signature"), env.stripeWebhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await processStripeWebhookEvent(createCrmServiceRoleClient(), event);
  return NextResponse.json({ ok: true, ...result });
}
