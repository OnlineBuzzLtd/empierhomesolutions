import { getServerEnv, publicEnv } from "@/lib/env";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * Returns the normalized origin (protocol + host + port) from a value if it
 * parses as an absolute URL, or null otherwise.
 */
export function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Returns the configured allowlist of origins (normalized).
 * Always includes NEXT_PUBLIC_SITE_URL. In non-production, also allows loopback.
 */
export function getAllowedOrigins(): Set<string> {
  const env = getServerEnv();
  const list = new Set<string>();

  const siteOrigin = toOrigin(publicEnv.siteUrl);
  if (siteOrigin) list.add(siteOrigin);

  for (const raw of (env.leadOriginAllowlist ?? "").split(/[,\s]+/)) {
    const normalized = toOrigin(raw);
    if (normalized) list.add(normalized);
  }

  if (!env.isProduction) {
    list.add("http://localhost:3000");
    list.add("http://127.0.0.1:3000");
  }

  return list;
}

/**
 * Given a Request, validate that the Origin/Referer header is on the allowlist.
 * Returns a decision describing whether it is allowed and which header matched.
 */
export function validateRequestOrigin(request: Request): {
  ok: boolean;
  origin: string | null;
  reason?: "missing_origin" | "disallowed_origin";
} {
  const allowed = getAllowedOrigins();
  const origin = toOrigin(request.headers.get("origin"));
  if (origin) {
    return allowed.has(origin)
      ? { ok: true, origin }
      : { ok: false, origin, reason: "disallowed_origin" };
  }

  const referer = toOrigin(request.headers.get("referer"));
  if (referer) {
    return allowed.has(referer)
      ? { ok: true, origin: referer }
      : { ok: false, origin: referer, reason: "disallowed_origin" };
  }

  const env = getServerEnv();
  if (!env.isProduction) {
    return { ok: true, origin: null };
  }

  return { ok: false, origin: null, reason: "missing_origin" };
}

export function isLoopbackOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
