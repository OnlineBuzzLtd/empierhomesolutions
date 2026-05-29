import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { handleInboundTextTurn } from "@/modules/crm/intake/inbound";
import { verifyTwilioSignature } from "@/modules/crm/intake/signatures";

function formParamsToRecord(body: string) {
  const params = new URLSearchParams(body);
  return [...params.entries()].reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

function twiml(message?: string) {
  const body = message ? `<Message>${message.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

function replyBodyFromCustomerJourneys(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const reply = (value as { replyMessage?: unknown }).replyMessage;
  if (!reply || typeof reply !== "object") {
    return null;
  }
  const body = (reply as { body?: unknown }).body;
  return typeof body === "string" && body.trim().length > 0 ? body.trim() : null;
}

export async function POST(request: Request) {
  const env = getCrmEnv();
  if (!env.twilioAuthToken) {
    return NextResponse.json({ error: "Twilio auth token is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const params = formParamsToRecord(rawBody);
  if (!verifyTwilioSignature({ request, params, authToken: env.twilioAuthToken })) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }

  const from = params.From?.trim();
  const to = params.To?.trim();
  const body = params.Body?.trim();
  if (!from || !to || !body) {
    return NextResponse.json({ error: "Missing From, To, or Body." }, { status: 400 });
  }

  try {
    const result = await handleInboundTextTurn(createCrmServiceRoleClient(), {
      tenantId: new URL(request.url).searchParams.get("tenant_id"),
      tenantSlug: new URL(request.url).searchParams.get("tenant_slug"),
      channel: from.toLowerCase().startsWith("whatsapp:") || to.toLowerCase().startsWith("whatsapp:") ? "whatsapp" : "sms",
      from,
      to,
      body,
      provider: "twilio",
      providerMessageId: params.MessageSid ?? params.SmsSid ?? null,
      metadata: {
        accountSid: params.AccountSid ?? null,
        messagingServiceSid: params.MessagingServiceSid ?? null,
        numMedia: params.NumMedia ?? null,
      },
    });

    const reply =
      "reply" in result
        ? result.reply
        : "customerJourneys" in result
          ? replyBodyFromCustomerJourneys(result.customerJourneys)
          : null;
    return twiml(reply ?? undefined);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process inbound Twilio message." },
      { status: 500 },
    );
  }
}
