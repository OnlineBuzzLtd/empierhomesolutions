import { NextResponse } from "next/server";
import { z } from "zod";
import {
  closeCustomerJourneysWebchatSession,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { assertDevRouteAuthorized, isDevRouteAuthGrant } from "@/modules/crm/lib/dev-auth";

const DEFAULT_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const closeSchema = z
  .object({
    tenant: z.string().trim().min(1).optional(),
    closeReason: z
      .enum(["customer_ended", "operator_closed", "timeout", "resolved", "test_harness"])
      .optional(),
    source: z.string().trim().min(1).max(64).optional(),
  })
  .default({});

async function resolveTenantId(
  supabase: ReturnType<typeof createCrmServiceRoleClient>,
  identifier: string | undefined,
): Promise<string> {
  if (!identifier) return DEFAULT_TENANT_ID;
  if (uuidPattern.test(identifier)) return identifier;
  const { data, error } = await supabase
    .schema("crm")
    .from("tenants")
    .select("id")
    .eq("slug", identifier)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Unknown tenant "${identifier}".`);
  return data.id;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await assertDevRouteAuthorized();
  if (!isDevRouteAuthGrant(auth)) {
    return auth.response;
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = closeSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const env = getCrmEnv();
    const supabase = env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient();
    const tenantId = env.crmE2ePlatformFixturesEnabled
      ? DEFAULT_TENANT_ID
      : await resolveTenantId(supabase, parsed.data.tenant);
    const link = await getCustomerJourneysRuntimeLink(supabase, tenantId);

    const result = await closeCustomerJourneysWebchatSession(link, {
      conversationId: id,
      closeReason: parsed.data.closeReason ?? "customer_ended",
      source: parsed.data.source ?? "dev_test_console",
    });

    return NextResponse.json({ session: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to close webchat session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
