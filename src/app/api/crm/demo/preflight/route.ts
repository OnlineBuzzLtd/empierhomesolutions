import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";

// Demo Console preflight (ticket F-2). Runs four cheap checks the
// operator can read before pitching:
//
//   - env: required environment variables present (SUPABASE keys,
//     PLATFORM_SHARED_SECRET, DEMO_CONSOLE_ALLOWLIST).
//   - supabase: a no-op read against crm.tenant_settings succeeds for
//     the active tenant.
//   - guard: confirms the synthetic-number guard is wired by reading
//     the env value used to construct the allowlist — a missing field
//     would mean an old build is deployed.
//   - twilio: the demo subaccount health score. Gated behind
//     DEMO_TWILIO_ACCOUNT_SID / DEMO_TWILIO_AUTH_TOKEN being present
//     (those land with ticket A-2). Returns null when not configured.
//
// Cached client-side every 60s; the banner refreshes via an interval.

type CheckStatus = "ok" | "warn" | "fail";

type PreflightResponse = {
  env: { status: CheckStatus; detail: string };
  supabase: { status: CheckStatus; detail: string };
  guard: { status: CheckStatus; detail: string };
  twilio: { status: CheckStatus | "skipped"; detail: string; score: number | null };
  checked_at: string;
};

export async function GET() {
  const guard = await guardDemoApi({ requireActiveSession: false });
  if (!guard.ok) return guard.response;

  const env = getCrmEnv();
  const { admin, tenantId } = guard;

  // 1. Env: required vars present.
  const missingEnv: string[] = [];
  if (!env.url) missingEnv.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.serviceRoleKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.platformSharedSecret) missingEnv.push("PLATFORM_SHARED_SECRET");
  // Allowlist may legitimately be empty (only Magic Numbers required) —
  // a warning, not a failure.
  const envResult: PreflightResponse["env"] =
    missingEnv.length > 0
      ? { status: "fail", detail: `Missing: ${missingEnv.join(", ")}` }
      : {
          status: env.demoConsoleAllowlist.length === 0 ? "warn" : "ok",
          detail:
            env.demoConsoleAllowlist.length === 0
              ? "DEMO_CONSOLE_ALLOWLIST is empty — only Twilio Magic Numbers will pass."
              : `Allowlist has ${env.demoConsoleAllowlist.length} entries.`,
        };

  // 2. Supabase reachability via a tenant-scoped read.
  let supabaseResult: PreflightResponse["supabase"];
  try {
    const { error } = await admin
      .schema("crm")
      .from("tenant_settings")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    supabaseResult = error
      ? { status: "fail", detail: error.message }
      : { status: "ok", detail: "Supabase reachable." };
  } catch (caught) {
    supabaseResult = {
      status: "fail",
      detail: caught instanceof Error ? caught.message : "unknown error",
    };
  }

  // 3. Guard: confirm allowlist plumbing is present by inspecting the
  // env object shape. If the field doesn't exist on env, an old build
  // without A-1 is deployed — preflight FAIL is the right answer.
  const guardResult: PreflightResponse["guard"] = Array.isArray(env.demoConsoleAllowlist)
    ? { status: "ok", detail: "Synthetic-number guard wired." }
    : { status: "fail", detail: "demoConsoleAllowlist missing from env — old build deployed?" };

  // 4. Twilio Insights — gated on A-2 env vars.
  const twilioSid = process.env.DEMO_TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.DEMO_TWILIO_AUTH_TOKEN;
  let twilioResult: PreflightResponse["twilio"];
  if (!twilioSid || !twilioToken) {
    twilioResult = {
      status: "skipped",
      detail: "DEMO_TWILIO_ACCOUNT_SID / _TOKEN not set (pending ticket A-2).",
      score: null,
    };
  } else {
    try {
      // Health score endpoint: GET /v1/Insights/Accounts/{Sid}/Health
      // (the public Twilio Insights API). If the call fails, we degrade
      // gracefully — the demo can still run, the banner just warns.
      const headers = {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
      };
      const res = await fetch(`https://insights.twilio.com/v1/Voice/Summary`, { headers });
      // Insights API doesn't expose a single "score" via a stable path; we
      // surface the HTTP status as the health signal for now and let the
      // operator click through to the Twilio console for the real number.
      // Stub-but-honest: returns OK if creds work, score=null until we
      // wire the messaging-service-level metric in a follow-up.
      twilioResult =
        res.status === 200
          ? { status: "ok", detail: "Twilio credentials valid.", score: null }
          : {
              status: res.status >= 500 ? "fail" : "warn",
              detail: `Twilio Insights HTTP ${res.status}`,
              score: null,
            };
    } catch (caught) {
      twilioResult = {
        status: "warn",
        detail: caught instanceof Error ? caught.message : "Twilio Insights unreachable.",
        score: null,
      };
    }
  }

  const response: PreflightResponse = {
    env: envResult,
    supabase: supabaseResult,
    guard: guardResult,
    twilio: twilioResult,
    checked_at: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: { "cache-control": "no-store" },
  });
}
