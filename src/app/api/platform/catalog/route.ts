import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { buildAiCatalogForTenant } from "@/modules/crm/lib/ai-catalog";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

async function resolveTenantId(request: Request) {
  const url = new URL(request.url);
  const directTenantId = url.searchParams.get("crmTenantId") ?? url.searchParams.get("tenantId");
  const workspaceId = url.searchParams.get("workspaceId");
  const customerJourneysTenantId =
    url.searchParams.get("customerJourneysTenantId") ?? url.searchParams.get("customerjourneysTenantId");

  const supabase = createCrmServiceRoleClient();
  const candidate = directTenantId ?? workspaceId;
  if (candidate) {
    const { data, error } = await supabase
      .schema("crm")
      .from("tenants")
      .select("id")
      .eq("id", candidate)
      .maybeSingle<{ id: string }>();
    if (error) throw error;
    if (data?.id) return data.id;
  }

  const runtimeTenantId = customerJourneysTenantId ?? workspaceId;
  if (runtimeTenantId) {
    const { data, error } = await supabase
      .schema("crm")
      .from("customerjourneys_runtime_links")
      .select("crm_tenant_id")
      .eq("customerjourneys_tenant_id", runtimeTenantId)
      .maybeSingle<{ crm_tenant_id: string }>();
    if (error) throw error;
    if (data?.crm_tenant_id) return data.crm_tenant_id;
  }

  return null;
}

export async function GET(request: Request) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const auth = verifyPlatformRequest(request, "", env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const tenantId = await resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const supabase = createCrmServiceRoleClient();
    const catalog = await buildAiCatalogForTenant(supabase, tenantId);
    if (!catalog) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    return NextResponse.json(catalog, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build AI catalogue." },
      { status: 500 },
    );
  }
}
