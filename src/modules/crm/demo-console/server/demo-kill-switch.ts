import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isRecentDemoKillSwitch(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) return false;
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return true;
  return nowMs - at < 24 * 60 * 60 * 1000;
}

export async function guardDemoKillSwitchClear(admin: SupabaseClient, tenantId: string) {
  const { data, error } = await admin
    .schema("crm")
    .from("tenant_settings")
    .select("demo_kill_switch_at")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ demo_kill_switch_at: string | null }>();
  if (error) {
    return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (isRecentDemoKillSwitch(data?.demo_kill_switch_at)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Demo kill switch is active. Clear it before running scripted webchat." },
        { status: 423 },
      ),
    };
  }
  return { ok: true as const };
}

