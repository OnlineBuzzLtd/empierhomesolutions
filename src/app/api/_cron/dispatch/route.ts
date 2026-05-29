import { NextResponse } from "next/server";
import { authenticateCronRequest } from "@/modules/crm/lib/cron-auth";
import { runDueCronJobs } from "@/modules/crm/lib/cron-registry";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const auth = authenticateCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const job = url.searchParams.get("job");
  const supabase = createCrmServiceRoleClient();
  const result = await runDueCronJobs(supabase, { onlyJob: job });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
