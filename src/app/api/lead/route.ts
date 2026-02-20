import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { leadRequestSchema, submitLeadToWebhook } from "@/modules/forms/api/submitLead";
import { getServerEnv, publicEnv } from "@/lib/env";

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 4;

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIp(headerStore: Awaited<ReturnType<typeof headers>>) {
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return headerStore.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = rateLimitStore.get(ip);

  if (!current || current.expiresAt <= now) {
    rateLimitStore.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  rateLimitStore.set(ip, current);
  return current.count > MAX_REQUESTS_PER_WINDOW;
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

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "Too many requests, try again in a minute.",
        },
      },
      { status: 429 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = leadRequestSchema.safeParse(payload);

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

  const submission = await submitLeadToWebhook(parsed.data);

  if (!submission.ok) {
    return NextResponse.json({ ok: false, error: submission.error }, { status: submission.status });
  }

  await fireServerConversion(parsed.data.leadType, parsed.data.service, parsed.data.location);

  return NextResponse.json({ ok: true });
}
