import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { handleInboundEmailLead } from "@/modules/crm/intake/inbound";
import { verifyStaticSecret } from "@/modules/crm/intake/signatures";

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstMailbox(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { Email?: unknown; Name?: unknown } | undefined;
    return {
      email: asString(first?.Email),
      name: asString(first?.Name),
    };
  }
  if (typeof value === "string") {
    return { email: value.trim(), name: null };
  }
  return { email: null, name: null };
}

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.postmarkInboundWebhookSecret) {
    return NextResponse.json({ error: "Postmark inbound webhook secret is not configured." }, { status: 503 });
  }

  const provided =
    request.headers.get("x-postmark-webhook-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!verifyStaticSecret({ configuredSecret: env.postmarkInboundWebhookSecret, providedSecret: provided })) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const from = firstMailbox(body.FromFull ?? body.From);
  const to = firstMailbox(body.ToFull ?? body.To);
  const textBody = asString(body.TextBody) ?? asString(body.StrippedTextReply) ?? asString(body.HtmlBody);
  if (!from.email || !to.email || !textBody) {
    return NextResponse.json({ error: "Missing inbound email From, To, or body." }, { status: 400 });
  }

  try {
    const result = await handleInboundEmailLead(createCrmServiceRoleClient(), {
      tenantId: new URL(request.url).searchParams.get("tenant_id"),
      tenantSlug: new URL(request.url).searchParams.get("tenant_slug"),
      fromEmail: from.email,
      fromName: from.name,
      toEmail: to.email,
      subject: asString(body.Subject),
      body: textBody,
      providerMessageId: asString(body.MessageID),
      metadata: {
        mailboxHash: asString(body.MailboxHash),
        tag: asString(body.Tag),
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process inbound Postmark email." },
      { status: 500 },
    );
  }
}
