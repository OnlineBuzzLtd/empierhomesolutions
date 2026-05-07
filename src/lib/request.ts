/**
 * Best-effort client IP extraction from common reverse-proxy headers. Returns
 * `"unknown"` when no header is present so that rate-limit keys remain stable
 * for anonymous callers (rather than bucketing them all under an empty key).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  // Vercel-specific header exposed on serverless handlers.
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const first = vercelIp.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
