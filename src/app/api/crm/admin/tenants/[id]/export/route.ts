import { NextResponse } from "next/server";

import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { recordTenantLifecycleEvent, requirePlatformAdmin } from "@/modules/crm/lib/platform-admin";
import { streamTenantExport } from "@/modules/crm/lib/tenant-export";

export const runtime = "nodejs";
// Exports can be large; keep the route away from edge caches.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  const gate = await requirePlatformAdmin(request);
  if (!gate.ok) {
    return gate.response;
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_tenant_id" }, { status: 400 });
  }

  const admin = createCrmServiceRoleClient();
  const { data: tenant, error } = await admin
    .schema("crm")
    .from("tenants")
    .select("id, slug, name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  await recordTenantLifecycleEvent({
    tenantId: id,
    action: "export",
    caller: gate.caller,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const line of streamTenantExport(id)) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  const filename = `tenant-${tenant.slug ?? tenant.id}-${new Date().toISOString().slice(0, 10)}.ndjson`;

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
