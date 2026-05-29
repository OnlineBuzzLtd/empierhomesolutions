import { getCrmEnv } from "@/modules/crm/lib/env";

export function authenticateCronRequest(request: Request) {
  const secret = getCrmEnv().cronSecret;
  if (!secret) {
    return { ok: false as const, status: 503, error: "Cron secret is not configured." };
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? "";
  const authorized = authorization === `Bearer ${secret}` || headerSecret === secret;

  if (!authorized) {
    return { ok: false as const, status: 401, error: "Unauthorized." };
  }

  return { ok: true as const };
}
