import { z } from "zod";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import { appendCustomerJourneysWebchatMessage, getCustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

const appendWebchatMessageSchema = z.object({
  conversationId: z.string().uuid("Conversation ID is required."),
  body: z.string().trim().min(1, "Message is required."),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = appendWebchatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid webchat message payload.");
  }

  try {
    const env = getCrmEnv();
    const link = await getCustomerJourneysRuntimeLink(
      env.crmE2ePlatformFixturesEnabled ? ({} as never) : createCrmServiceRoleClient(),
      auth.session.tenant.id,
    );
    const response = await appendCustomerJourneysWebchatMessage(link, {
      conversationId: parsed.data.conversationId,
      body: parsed.data.body,
      metadata: parsed.data.metadata,
    });

    return jsonSuccess({
      session: response,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to send the linked webchat message.", 502);
  }
}
