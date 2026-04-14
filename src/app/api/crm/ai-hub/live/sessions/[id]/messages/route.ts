import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { jsonError, jsonSuccess, requireManagerCrmApiUser } from "@/modules/crm/lib/api";
import {
  appendCustomerMessageToLiveSession,
  applyLiveAgentResult,
  buildLiveAgentInput,
  buildPlatformEventsFromLiveAgentResult,
  canAccessLiveFrontDeskTester,
  liveFrontDeskMessageCreateSchema,
  loadLiveFrontDeskSession,
  recordLiveAgentFailure,
  resolveLiveSessionWorkspaceAlias,
  syncLiveConversationImpacts,
} from "@/modules/crm/lib/ai-hub-live";
import {
  LiveAgentAuthError,
  LiveAgentNotConfiguredError,
  LiveAgentRequestError,
  createLiveAgentAdapter,
  isLiveAgentRuntimeConfigured,
} from "@/modules/crm/lib/ai-hub-live-agent";
import { processPlatformEvent } from "@/modules/platform/lib/processor";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant, profile } = auth.session;
  if (!canAccessLiveFrontDeskTester({ tenantId: tenant.id, role: profile?.role })) {
    return jsonError("The live front desk tester is only available for Empire tenant 1 management/admin users.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = liveFrontDeskMessageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid live message payload.");
  }

  const { id } = await context.params;

  try {
    const session = await loadLiveFrontDeskSession(supabase, tenant.id, id);
    if (!session) {
      return jsonError("Live front desk session not found.", 404);
    }

    await appendCustomerMessageToLiveSession(supabase, {
      tenantId: tenant.id,
      conversationId: id,
      channel: session.conversation.channel as "sms" | "whatsapp" | "web_chat",
      customerName: session.conversation.customer_name,
      body: parsed.data.body,
      nextSortOrder: session.conversation.messages.length + 1,
    });

    const sessionWithCustomerMessage = await loadLiveFrontDeskSession(supabase, tenant.id, id);
    if (!sessionWithCustomerMessage) {
      return jsonError("Live front desk session not found after message append.", 404);
    }

    const serviceRole = createCrmServiceRoleClient();
    const alias = await resolveLiveSessionWorkspaceAlias(serviceRole, tenant.id);
    if (!alias) {
      return jsonError("Workspace alias not found for the active tenant.", 404);
    }

    const conversationStarted = Boolean(sessionWithCustomerMessage.platformRecord);

    try {
      const adapter = createLiveAgentAdapter();
      const result = await adapter.send(buildLiveAgentInput(alias, sessionWithCustomerMessage));

      await applyLiveAgentResult(supabase, {
        tenantId: tenant.id,
        session: sessionWithCustomerMessage,
        result,
      });

      const events = buildPlatformEventsFromLiveAgentResult({
        alias,
        session: sessionWithCustomerMessage,
        result,
        customerMessageBody: parsed.data.body,
        conversationStarted,
      });

      for (const event of events) {
        const processed = await processPlatformEvent(serviceRole, event);
        if (!processed.alias) {
          return jsonError("Workspace alias not found for the active tenant.", 404);
        }
      }

      const processedSession = await loadLiveFrontDeskSession(supabase, tenant.id, id);
      if (!processedSession) {
        return jsonError("Live front desk session not found after processing.", 404);
      }

      await syncLiveConversationImpacts(supabase, {
        tenantId: tenant.id,
        conversationId: id,
        session: processedSession,
      });

      const finalSession = await loadLiveFrontDeskSession(supabase, tenant.id, id);
      return jsonSuccess({
        session: finalSession,
        runtime_configured: isLiveAgentRuntimeConfigured(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Live agent runtime request failed.";
      await recordLiveAgentFailure(supabase, {
        tenantId: tenant.id,
        session: sessionWithCustomerMessage,
        message,
      });

      const failedSession = await loadLiveFrontDeskSession(supabase, tenant.id, id);
      const status =
        error instanceof LiveAgentNotConfiguredError
          ? 503
          : error instanceof LiveAgentAuthError || error instanceof LiveAgentRequestError
            ? 502
            : 500;

      return jsonErrorWithSession(message, status, failedSession);
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to send live message.", 500);
  }
}

function jsonErrorWithSession(message: string, status: number, session: unknown) {
  return new Response(
    JSON.stringify({
      error: message,
      session,
      runtime_configured: isLiveAgentRuntimeConfigured(),
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
      },
    },
  );
}
