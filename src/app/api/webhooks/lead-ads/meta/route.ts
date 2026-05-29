import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { handleLeadAdWebhook } from "@/modules/crm/intake/lead-ads";
import { verifySha256Signature } from "@/modules/crm/intake/signatures";

export async function GET(request: Request) {
  const env = getCrmEnv();
  const url = new URL(request.url);
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (!env.metaLeadAdsVerifyToken || token !== env.metaLeadAdsVerifyToken || !challenge) {
    return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  }
  return new Response(challenge, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.metaLeadAdsAppSecret) {
    return NextResponse.json({ error: "Meta Lead Ads app secret is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (
    !verifySha256Signature({
      rawBody,
      secret: env.metaLeadAdsAppSecret,
      signatureHeader: request.headers.get("x-hub-signature-256"),
      prefix: "sha256=",
    })
  ) {
    return NextResponse.json({ error: "Invalid Meta signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const result = await handleLeadAdWebhook(createCrmServiceRoleClient(), {
      provider: "meta",
      body,
      tenantId: url.searchParams.get("tenant_id"),
      tenantSlug: url.searchParams.get("tenant_slug"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process Meta lead ad webhook." },
      { status: 500 },
    );
  }
}
