// Public-link helpers: token mint / rotate, expiry handling, and
// metering hooks for accept/reject events.
//
// Tokens are 128-bit UUIDs (gen_random_uuid in Postgres or crypto.randomUUID
// in Node). Each call rotates the token so a previously-shared link
// is invalidated. Default TTL: 30 days, configurable per call.

import { randomUUID } from "node:crypto";

export type PublicLinkResult = {
  token: string;
  expires_at: string;
};

export function buildPublicLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/q/${token}`;
}

export function mintToken(ttlDays: number): PublicLinkResult {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  return {
    token: randomUUID(),
    expires_at: expires.toISOString(),
  };
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}
