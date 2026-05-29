import { NextResponse } from "next/server";
import { authenticateCronRequest } from "@/modules/crm/lib/cron-auth";
import { dispatchDueNotifications } from "@/modules/crm/notifications/scheduler";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const auth = authenticateCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createCrmServiceRoleClient();
  const result = await dispatchDueNotifications(supabase);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
