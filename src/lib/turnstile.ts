import { getServerEnv } from "@/lib/env";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerification = {
  ok: boolean;
  reason?:
    | "missing_secret"
    | "missing_token"
    | "invalid_token"
    | "verification_unreachable"
    | "bypass_dev";
  errorCodes?: string[];
  hostname?: string;
  cdata?: string;
};

export function turnstileEnabled(): boolean {
  const env = getServerEnv();
  return Boolean(env.turnstileSecretKey);
}

/**
 * Verify a Cloudflare Turnstile token.
 * - Returns ok=true immediately in non-production environments when no secret
 *   is configured (so local dev/test doesn't need a real Turnstile key).
 * - Returns ok=false in production if the secret is missing (fail-closed).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp: string | null | undefined,
): Promise<TurnstileVerification> {
  const env = getServerEnv();

  if (!env.turnstileSecretKey) {
    if (env.isProduction) {
      return { ok: false, reason: "missing_secret" };
    }
    return { ok: true, reason: "bypass_dev" };
  }

  if (!token || typeof token !== "string" || token.length < 10) {
    return { ok: false, reason: "missing_token" };
  }

  const form = new URLSearchParams();
  form.set("secret", env.turnstileSecretKey);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, reason: "verification_unreachable" };
    }

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      hostname?: string;
      cdata?: string;
    };

    if (!data.success) {
      return {
        ok: false,
        reason: "invalid_token",
        errorCodes: data["error-codes"],
        hostname: data.hostname,
        cdata: data.cdata,
      };
    }

    return { ok: true, hostname: data.hostname, cdata: data.cdata };
  } catch {
    return { ok: false, reason: "verification_unreachable" };
  }
}
