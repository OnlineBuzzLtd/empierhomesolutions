import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { handleLeadAdWebhook } from "@/modules/crm/intake/lead-ads";
import { verifyStaticSecret } from "@/modules/crm/intake/signatures";

export async function GET(request: Request) {
  const env = getCrmEnv();
  const url = new URL(request.url);
  const token = url.searchParams.get("hub.verify_token") ?? url.searchParams.get("verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? url.searchParams.get("challenge");
  if (!env.googleLeadAdsVerifyToken || token !== env.googleLeadAdsVerifyToken || !challenge) {
    return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  }
  return new Response(challenge, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.googleLeadAdsWebhookSecret) {
    return NextResponse.json({ error: "Google Lead Ads webhook secret is not configured." }, { status: 503 });
  }
  const provided =
    request.headers.get("x-google-lead-ads-secret") ??
    request.headers.get("x-webhook-secret") ??
    new URL(request.url).searchParams.get("secret");
  if (!verifyStaticSecret({ configuredSecret: env.googleLeadAdsWebhookSecret, providedSecret: provided })) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const result = await handleLeadAdWebhook(createCrmServiceRoleClient(), {
      provider: "google",
      body,
      tenantId: url.searchParams.get("tenant_id"),
      tenantSlug: url.searchParams.get("tenant_slug"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process Google lead ad webhook." },
      { status: 500 },
    );
  }
}
