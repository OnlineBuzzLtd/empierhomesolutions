// Shared HMAC-SHA256 verifier for inbound requests from the
// CustomerJourneys platform-api. Mirrors the signing scheme the
// platform side uses in services/platform-api/src/lib/crm-platform-events.ts
// and packages/integrations/src/calendar/crm.ts.
//
// Header convention:
//   x-platform-timestamp: unix seconds (string)
//   x-platform-signature: "sha256=" + hex(HMAC_SHA256(secret, "${ts}.${rawBody}"))
//
// Replay protection: requests outside ±5 minutes of server now() are rejected.

import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 5 * 60;

export type PlatformAuthResult =
  | { ok: true; method: "hmac" }
  | { ok: false; status: number; error: string };

function headerValue(request: Request, name: string): string {
  return request.headers.get(name)?.trim() ?? "";
}

function computeSignature(secret: string, timestamp: string, rawBody: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

function verifySignature(secret: string, timestamp: string, rawBody: string, provided: string): boolean {
  const expected = computeSignature(secret, timestamp, rawBody);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Verify an HMAC-signed platform request. The caller must already have
 * the raw request body (via `await request.text()`) because Next.js's
 * `request.json()` consumes the body irreversibly.
 *
 * SHARED-SECRET FALLBACK IS NOT SUPPORTED on calendar endpoints. The
 * push-events route still tolerates the legacy header during migration,
 * but the calendar endpoints are net-new — they MUST be HMAC-signed.
 */
export function verifyPlatformRequest(request: Request, rawBody: string, sharedSecret: string): PlatformAuthResult {
  const signature = headerValue(request, "x-platform-signature");
  const timestamp = headerValue(request, "x-platform-timestamp");

  if (signature.length === 0) {
    return { ok: false, status: 401, error: "Missing x-platform-signature." };
  }
  if (timestamp.length === 0) {
    return { ok: false, status: 400, error: "Missing x-platform-timestamp." };
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, status: 400, error: "Invalid x-platform-timestamp." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_SKEW_SECONDS) {
    return { ok: false, status: 401, error: "Timestamp outside allowed skew window." };
  }

  if (!verifySignature(sharedSecret, timestamp, rawBody, signature)) {
    return { ok: false, status: 401, error: "Invalid x-platform-signature." };
  }

  return { ok: true, method: "hmac" };
}
