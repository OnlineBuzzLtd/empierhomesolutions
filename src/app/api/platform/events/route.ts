import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { platformEventEnvelopeSchema } from "@/modules/platform/contracts";
import { processPlatformEvent } from "@/modules/platform/lib/processor";
import {
  collectPhonesFromPayload,
  evaluatePhoneNumber,
} from "@/modules/platform/lib/synthetic-number-guard";

const MAX_SKEW_SECONDS = 5 * 60;

function headerValue(request: Request, name: string) {
  return request.headers.get(name)?.trim() ?? "";
}

function computeSignature(secret: string, timestamp: string, rawBody: string) {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string) {
  const expected = computeSignature(secret, timestamp, rawBody);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  try {
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

function authenticateRequest(request: Request, rawBody: string, configuredSecret: string):
  | { ok: true; method: "hmac" | "shared_secret" }
  | { ok: false; status: number; error: string } {
  const signatureHeader = headerValue(request, "x-platform-signature");
  const timestampHeader = headerValue(request, "x-platform-timestamp");

  // HMAC path — preferred. Any request that carries x-platform-signature
  // MUST verify cleanly; we refuse to silently fall back to the shared
  // secret so a leaked header can't degrade to the weaker auth.
  if (signatureHeader.length > 0) {
    if (timestampHeader.length === 0) {
      return { ok: false, status: 400, error: "Missing x-platform-timestamp." };
    }

    const timestampSeconds = Number.parseInt(timestampHeader, 10);
    if (!Number.isFinite(timestampSeconds)) {
      return { ok: false, status: 400, error: "Invalid x-platform-timestamp." };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > MAX_SKEW_SECONDS) {
      return { ok: false, status: 401, error: "Timestamp outside allowed skew window." };
    }

    if (!verifySignature(configuredSecret, timestampHeader, rawBody, signatureHeader)) {
      return { ok: false, status: 401, error: "Invalid x-platform-signature." };
    }

    return { ok: true, method: "hmac" };
  }

  // Legacy shared-secret fallback — supports platform-api deployments that
  // haven't been rolled to the HMAC build yet. Phase 2 of the hardening plan
  // deprecates this path; remove it once the outbox migration is verified
  // in production.
  const sharedSecret = headerValue(request, "x-platform-shared-secret");
  if (sharedSecret.length === 0) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  const expectedBuf = Buffer.from(configuredSecret, "utf8");
  const providedBuf = Buffer.from(sharedSecret, "utf8");
  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  try {
    if (!timingSafeEqual(expectedBuf, providedBuf)) {
      return { ok: false, status: 401, error: "Unauthorized." };
    }
  } catch {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  return { ok: true, method: "shared_secret" };
}

export async function POST(request: Request) {
  const env = getCrmEnv();
  const configuredSecret = env.platformSharedSecret;

  if (!configuredSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const auth = authenticateRequest(request, rawBody, configuredSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = platformEventEnvelopeSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid platform event payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Synthetic-number guard. Refuses payloads whose phone fields match
  // historical synthetic patterns (the May 12 / May 14 Twilio incident
  // fingerprints). DEMO_CONSOLE_ALLOWLIST overrides; Twilio Magic Numbers
  // always pass. See synthetic-number-guard.ts for the full rationale.
  const phones = collectPhonesFromPayload(parsed.data);
  for (const { field, value } of phones) {
    const decision = evaluatePhoneNumber(value, { allowlist: env.demoConsoleAllowlist });
    if (!decision.ok) {
      return NextResponse.json(
        { code: "synthetic_number_blocked", pattern: decision.pattern, field },
        { status: 422 },
      );
    }
  }

  const supabase = createCrmServiceRoleClient();

  try {
    const result = await processPlatformEvent(supabase, parsed.data);
    if (!result.alias) {
      return NextResponse.json({ error: "Workspace alias not found." }, { status: 404 });
    }
    return NextResponse.json(
      {
        ok: true,
        auth: auth.method,
        commands_enqueued: result.commandsEnqueued,
        deferred: result.deferred ?? false,
      },
      { status: result.deferred ? 202 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Failed to process platform event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
