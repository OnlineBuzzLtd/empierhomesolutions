/**
 * Self-contained demo auth — a single shared login, gated by a signed cookie.
 * This is intentionally NOT Supabase: the demo is isolated from the real CRM's
 * auth and data. It only protects a fictional, read-only-ish sandbox.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEMO_CRM_EMAIL = "demo@empirecrm.test";
export const DEMO_SESSION_COOKIE = "demo_crm_session";
/** 8 hours — long enough for a trial session, short enough to expire. */
export const DEMO_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function getPassword(): string {
  return process.env.DEMO_CRM_PASSWORD || "trade2026";
}

function getSecret(): string {
  return process.env.DEMO_CRM_SESSION_SECRET || "demo-crm-local-secret";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCredentials(email: string, password: string): boolean {
  const emailOk = safeEqual(email.trim().toLowerCase(), DEMO_CRM_EMAIL);
  const passwordOk = safeEqual(password, getPassword());
  // Evaluate both before returning so timing doesn't leak which field failed.
  return emailOk && passwordOk;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Create a session token: `<issuedAtMs>.<hmac>`. */
export function createSessionToken(now: number = Date.now(), secret: string = getSecret()): string {
  const issuedAt = String(now);
  return `${issuedAt}.${sign(issuedAt, secret)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  now: number = Date.now(),
  secret: string = getSecret(),
  maxAgeMs: number = DEMO_SESSION_MAX_AGE_MS,
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const issuedAt = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(issuedAt, secret);
  if (!safeEqual(sig, expected)) return false;
  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) return false;
  return now - issuedAtMs <= maxAgeMs && now - issuedAtMs >= 0;
}

export const demoSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.floor(DEMO_SESSION_MAX_AGE_MS / 1000),
  secure: process.env.NODE_ENV === "production",
};

/** Whether the demo surface is enabled. Off in production unless explicitly turned on. */
export function isDemoCrmEnabled(): boolean {
  const flag = process.env.ENABLE_DEMO_CRM;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}
