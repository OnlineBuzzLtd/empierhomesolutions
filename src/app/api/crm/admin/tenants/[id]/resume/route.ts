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
      status: "active",
      suspended_at: null,
      suspended_reason: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin
    .schema("crm")
    .from("tenant_memberships")
    .update({ active: true })
    .eq("tenant_id", id);

  await recordTenantLifecycleEvent({
    tenantId: id,
    action: "resume",
    caller: gate.caller,
  });

  return NextResponse.json({ ok: true, tenant_id: id, status: "active" });
}
