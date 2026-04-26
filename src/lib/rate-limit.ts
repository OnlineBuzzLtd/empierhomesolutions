import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env";

type WindowSpec = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

type LimiterConfig = {
  tokens: number;
  window: WindowSpec;
  prefix?: string;
};

export type RateLimitDecision = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
  reason?: "rate_limited" | "not_configured";
};

type MemoryEntry = { count: number; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();

function parseWindowToMs(window: WindowSpec): number {
  const [raw, unit] = window.split(" ") as [string, WindowSpec extends `${number} ${infer U}` ? U : never];
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid rate limit window: ${window}`);
  switch (unit) {
    case "ms":
      return n;
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unsupported rate limit window unit: ${String(unit)}`);
  }
}

function checkMemory(key: string, cfg: LimiterConfig): RateLimitDecision {
  const now = Date.now();
  const windowMs = parseWindowToMs(cfg.window);
  const existing = memoryStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowMs });
    return { ok: true, limit: cfg.tokens, remaining: cfg.tokens - 1, reset: now + windowMs };
  }

  existing.count += 1;
  memoryStore.set(key, existing);
  const remaining = Math.max(0, cfg.tokens - existing.count);
  return {
    ok: existing.count <= cfg.tokens,
    limit: cfg.tokens,
    remaining,
    reset: existing.expiresAt,
    reason: existing.count > cfg.tokens ? "rate_limited" : undefined,
  };
}

let cachedRedis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const env = getServerEnv();
  if (env.upstashRedisUrl && env.upstashRedisToken) {
    cachedRedis = new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken });
  } else {
    cachedRedis = null;
  }
  return cachedRedis;
}

const limiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(cfg: LimiterConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${cfg.prefix ?? "rl"}:${cfg.tokens}:${cfg.window}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.tokens, cfg.window),
      analytics: false,
      prefix: cfg.prefix ?? "rl",
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

export async function consumeRateLimit(key: string, cfg: LimiterConfig): Promise<RateLimitDecision> {
  try {
    const limiter = getUpstashLimiter(cfg);
    if (limiter) {
      const result = await limiter.limit(key);
      return {
        ok: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
        reason: result.success ? undefined : "rate_limited",
      };
    }
  } catch (error) {
    // Fall through to in-memory fallback if Upstash errors out (network/etc.)
    console.warn("[rate-limit] Upstash error, falling back to memory", error);
  }
  return checkMemory(key, cfg);
}

export function rateLimitHeaders(decision: RateLimitDecision): HeadersInit {
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(Math.ceil(decision.reset / 1000)),
    "Retry-After": decision.ok ? "0" : String(Math.max(1, Math.ceil((decision.reset - Date.now()) / 1000))),
  };
}
