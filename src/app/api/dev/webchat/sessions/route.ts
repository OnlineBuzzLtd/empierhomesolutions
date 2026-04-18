import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCustomerJourneysWebchatSession,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

const DEFAULT_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  identifierValue: z.string().trim().min(1, "Identifier value is required.").optional(),
  fullName: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  openingMessage: z.string().trim().min(1, "Opening message is required."),
  tenant: z.string().trim().min(1).optional(),
});

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

function isLocalOrDevEnabled() {
  return process.env.DEV_TEST_UI_ENABLED === "1" || process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!isLocalOrDevEnabled()) {
    return NextResponse.json({ error: "Dev test UI is disabled." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
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

    const response = await createCustomerJourneysWebchatSession(link, {
      identifierValue: parsed.data.identifierValue?.trim() || `dev-test-${Date.now()}`,
      fullName: parsed.data.fullName?.trim() || undefined,
      email: parsed.data.email?.trim() || undefined,
      openingMessage: parsed.data.openingMessage,
    });

    return NextResponse.json({ session: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open webchat session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
