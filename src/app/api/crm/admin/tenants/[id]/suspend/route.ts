import { NextResponse } from "next/server";

import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { recordTenantLifecycleEvent, requirePlatformAdmin } from "@/modules/crm/lib/platform-admin";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  const gate = await requirePlatformAdmin(request);
  if (!gate.ok) {
    return gate.response;
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const admin = createCrmServiceRoleClient();

  const { data: tenant, error: loadError } = await admin
    .schema("crm")
    .from("tenants")
    .select("id, status, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  if (!tenant || tenant.deleted_at) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const { error: updateError } = await admin
    .schema("crm")
    .from("tenants")
    .update({
      status: "suspended",
      suspended_at: new Date().toISOString(),
      suspended_reason: body.reason ?? null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin
    .schema("crm")
    .from("tenant_memberships")
    .update({ active: false })
    .eq("tenant_id", id);

  await recordTenantLifecycleEvent({
    tenantId: id,
    action: "suspend",
    caller: gate.caller,
    reason: body.reason ?? null,
  });

  return NextResponse.json({ ok: true, tenant_id: id, status: "suspended" });
}
