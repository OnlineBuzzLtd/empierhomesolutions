import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { leadRequestSchema, submitLeadToWebhook } from "@/modules/forms/api/submitLead";
import { getServerEnv, publicEnv } from "@/lib/env";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { validateRequestOrigin } from "@/lib/origin";
import { verifyTurnstileToken } from "@/lib/turnstile";

function getClientIp(headerStore: Awaited<ReturnType<typeof headers>>) {
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return headerStore.get("x-real-ip") ?? "unknown";
}

async function fireServerConversion(leadType: string, service?: string, location?: string) {
  const serverEnv = getServerEnv();

  try {
    await fetch(new URL("/api/conversion", publicEnv.siteUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-conversion-secret": serverEnv.conversionApiSecret,
      },
      body: JSON.stringify({
        leadType,
        service,
        location,
        source: "lead_api",
      }),
    });
  } catch {
    return;
  }
}

export async function POST(request: Request) {
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  const originCheck = validateRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_origin",
          message: "Origin is not allowed.",
        },
      },
      { status: 403 },
    );
  }

  const rateKey = `lead:${ip}`;
  const decision = await consumeRateLimit(rateKey, {
    tokens: 4,
    window: "1 m",
    prefix: "rl:lead",
  });
  if (!decision.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "Too many requests, try again in a minute.",
        },
      },
      { status: 429, headers: rateLimitHeaders(decision) },
    );
  }

  const payload = await request.json().catch(() => null);

  // Extract Turnstile token if present; supports either top-level or nested under
  // `turnstileToken` / `cf-turnstile-response` (the Turnstile widget default name).
  const turnstileToken =
    (payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).turnstileToken ??
        (payload as Record<string, unknown>)["cf-turnstile-response"])
      : null) as string | null | undefined;

  const turnstile = await verifyTurnstileToken(turnstileToken, ip === "unknown" ? null : ip);
  if (!turnstile.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "bot_check_failed",
          message: "Could not verify you are human. Please reload the page and try again.",
        },
      },
      { status: 403 },
    );
  }

  // Sanitize payload: drop `turnstileToken` / `cf-turnstile-response` before schema parse.
  let sanitizedPayload: unknown = payload;
  if (payload && typeof payload === "object") {
    const { turnstileToken: _t, ["cf-turnstile-response"]: _c, ...rest } = payload as Record<string, unknown>;
    sanitizedPayload = {
      ...rest,
      // The client MAY still send `origin` in the payload for backwards compat,
      // but we do not trust it — server-side origin is the source of truth.
      origin: originCheck.origin ?? (rest as Record<string, unknown>).origin,
    };
  }

  const parsed = leadRequestSchema.safeParse(sanitizedPayload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "validation_failed",
          message: "Lead payload is invalid.",
        },
      },
      { status: 400 },
    );
  }

  // Overwrite payload origin with validated header origin (defence in depth).
  const leadData = { ...parsed.data, origin: originCheck.origin ?? parsed.data.origin };

  const submission = await submitLeadToWebhook(leadData);

  if (!submission.ok) {
    return NextResponse.json({ ok: false, error: submission.error }, { status: submission.status });
  }

  await fireServerConversion(leadData.leadType, leadData.service, leadData.location);

  return NextResponse.json({ ok: true }, { headers: rateLimitHeaders(decision) });
}
