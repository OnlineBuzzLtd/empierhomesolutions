import { NextResponse } from "next/server";
import {
  loadChannelTestRuntimeSnapshot,
  type ChannelTestRuntimeSnapshot,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { assertDevRouteAuthorized, isDevRouteAuthGrant } from "@/modules/crm/lib/dev-auth";
import { listPlatformConversationRecords } from "@/modules/platform/lib/repository";

const DEFAULT_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const DEFAULT_TENANT_SLUG = "empire-home-solutions";
const DEFAULT_TENANT_NAME = "Empire Home Solutions";

type RawRow = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
};

async function resolveTenant(
  supabase: ReturnType<typeof createCrmServiceRoleClient>,
  identifier: string | null,
): Promise<ResolvedTenant | null> {
  if (!identifier) {
    return { id: DEFAULT_TENANT_ID, slug: DEFAULT_TENANT_SLUG, name: DEFAULT_TENANT_NAME };
  }
  const column = uuidPattern.test(identifier) ? "id" : "slug";
  const { data, error } = await supabase
    .schema("crm")
    .from("tenants")
    .select("id, slug, name")
    .eq(column, identifier)
    .maybeSingle<ResolvedTenant>();

  if (error) {
    throw new Error(`tenants lookup: ${error.message}`);
  }
  return data ?? null;
}

async function fetchRecent(
  supabase: ReturnType<typeof createCrmServiceRoleClient>,
  table: string,
  orderColumn: string,
  tenantId: string,
  since: string | null,
  limit: number,
): Promise<RawRow[]> {
  let query = supabase
    .schema("crm")
    .from(table)
    .select("*")
    .eq("tenant_id", tenantId)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte(orderColumn, since);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return (data ?? []) as RawRow[];
}

export async function GET(request: Request) {
  const auth = await assertDevRouteAuthorized();
  if (!isDevRouteAuthGrant(auth)) {
    return auth.response;
  }

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const tenantParam = url.searchParams.get("tenant");
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 200 ? limit : 50;
  const serverNow = new Date().toISOString();

  const env = getCrmEnv();

  try {
    let snapshot: ChannelTestRuntimeSnapshot;
    let events: RawRow[] = [];
    let commands: RawRow[] = [];
    let conversations: RawRow[] = [];

    if (env.crmE2ePlatformFixturesEnabled) {
      snapshot = await loadChannelTestRuntimeSnapshot({} as never, DEFAULT_TENANT_ID);
      return NextResponse.json({
        tenant: {
          id: DEFAULT_TENANT_ID,
          slug: DEFAULT_TENANT_SLUG,
          name: DEFAULT_TENANT_NAME,
          customerJourneysRuntimeTenantId: snapshot.link?.customerjourneys_tenant_id ?? null,
        },
        runtime: {
          configured: snapshot.runtimeConfigured,
          link: snapshot.link,
          surface: snapshot.runtime,
        },
        events,
        commands,
        conversations,
        recentRecords: snapshot.recentRecords,
        serverNow,
        since: since ?? null,
      });
    }

    if (!env.adminEnabled) {
      return NextResponse.json(
        {
          error:
            "Supabase admin env is not configured. Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local.",
        },
        { status: 503 },
      );
    }

    const supabase = createCrmServiceRoleClient();
    const tenant = await resolveTenant(supabase, tenantParam);
    if (!tenant) {
      return NextResponse.json(
        { error: `Unknown tenant "${tenantParam}". Use the CRM tenant id or slug.` },
        { status: 404 },
      );
    }

    snapshot = await loadChannelTestRuntimeSnapshot(supabase, tenant.id);

    const expandedRecords = await listPlatformConversationRecords(supabase, tenant.id, 20).catch((err) => {
      console.error("[dev/test-feed] listPlatformConversationRecords", err);
      return snapshot.recentRecords;
    });
    snapshot = { ...snapshot, recentRecords: expandedRecords };

    [events, commands, conversations] = await Promise.all([
      fetchRecent(supabase, "platform_event_log", "occurred_at", tenant.id, since, safeLimit).catch((err) => {
        console.error("[dev/test-feed] platform_event_log", err);
        return [] as RawRow[];
      }),
      fetchRecent(supabase, "platform_command_log", "issued_at", tenant.id, since, safeLimit).catch((err) => {
        console.error("[dev/test-feed] platform_command_log", err);
        return [] as RawRow[];
      }),
      fetchRecent(supabase, "platform_conversation_links", "latest_event_at", tenant.id, since, safeLimit).catch(
        (err) => {
          console.error("[dev/test-feed] platform_conversation_links", err);
          return [] as RawRow[];
        },
      ),
    ]);

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        customerJourneysRuntimeTenantId: snapshot.link?.customerjourneys_tenant_id ?? null,
      },
      runtime: {
        configured: snapshot.runtimeConfigured,
        link: snapshot.link,
        surface: snapshot.runtime,
      },
      events,
      commands,
      conversations,
      recentRecords: snapshot.recentRecords,
      serverNow,
      since: since ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error loading dev test feed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
