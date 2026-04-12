import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { createCustomerJourneysWebchatSession, getCustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

const createWebchatSessionSchema = z.object({
  identifierValue: z.string().trim().min(1, "Identifier value is required."),
  fullName: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  openingMessage: z.string().trim().min(1, "Opening message is required."),
});

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createWebchatSessionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid webchat session payload.");
  }

  try {
    const env = getCrmEnv();
    const link = await getCustomerJourneysRuntimeLink(
      env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient(),
      auth.session.tenant.id,
    );
    const response = await createCustomerJourneysWebchatSession(link, {
      identifierValue: parsed.data.identifierValue,
      fullName: parsed.data.fullName?.trim() || undefined,
      email: parsed.data.email?.trim() || undefined,
      openingMessage: parsed.data.openingMessage,
    });

    return jsonSuccess({
      session: response,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to open the linked webchat session.", 502);
  }
}
