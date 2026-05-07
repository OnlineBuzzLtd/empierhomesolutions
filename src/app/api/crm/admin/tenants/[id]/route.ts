import { NextResponse } from "next/server";

import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { recordTenantLifecycleEvent, requirePlatformAdmin } from "@/modules/crm/lib/platform-admin";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Soft-delete a tenant. The companion reaper script
// (`scripts/ops/tenant-hard-delete-reaper.mjs`) cascades a true delete
// 30 days later. Until then, the tenant is fully quiesced:
// status=archived, deleted_at set, memberships deactivated.
export async function DELETE(request: Request, context: Params) {
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
    .select("id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  if (tenant.deleted_at) {
    return NextResponse.json({ ok: true, tenant_id: id, already: true });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .schema("crm")
    .from("tenants")
    .update({
      status: "archived",
      deleted_at: now,
      suspended_at: now,
      suspended_reason: body.reason ?? "soft_delete",
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
    action: "soft_delete",
    caller: gate.caller,
    reason: body.reason ?? null,
    metadata: { hard_delete_eligible_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
  });

  return NextResponse.json({ ok: true, tenant_id: id, status: "archived" });
}
