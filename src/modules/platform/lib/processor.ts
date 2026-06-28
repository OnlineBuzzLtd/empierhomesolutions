import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";
import { sendPlatformLeadAlertSms } from "@/modules/crm/notifications/lead-alerts";
import { executePlatformCommand } from "@/modules/platform/lib/command-executor";
import { validatePlatformEventContract } from "@/modules/platform/lib/event-contracts";
import { derivePlatformCommandsFromEvent } from "@/modules/platform/lib/integration";
import {
  enqueuePlatformCommand,
  recordPlatformEvent,
  resolveWorkspaceAliasForIncomingWorkspaceId,
  updatePlatformCommandStatus,
  updatePlatformEventStatus,
} from "@/modules/platform/lib/repository";

async function sendPlatformLeadAlertBestEffort(
  supabase: SupabaseClient,
  alias: Awaited<ReturnType<typeof resolveWorkspaceAliasForIncomingWorkspaceId>>,
  envelope: PlatformEventEnvelope,
) {
  if (!alias) {
    return;
  }

  try {
    const result = await sendPlatformLeadAlertSms(supabase, alias, envelope);
    if (!result.ok) {
      console.warn(
        JSON.stringify({
          event: "platform_lead_alert_sms_failed",
          warning: result.warning,
          tenantId: alias.tenant_id,
          platformEventId: envelope.event_id,
          platformEventType: envelope.event_type,
        }),
      );
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "platform_lead_alert_sms_failed",
        warning: error instanceof Error ? error.message : "Lead alert SMS failed.",
        tenantId: alias.tenant_id,
        platformEventId: envelope.event_id,
        platformEventType: envelope.event_type,
      }),
    );
  }
}

export async function processPlatformEvent(
  supabase: SupabaseClient,
  envelope: PlatformEventEnvelope,
) {
  const nonFatalLifecycleEvents = new Set<PlatformEventEnvelope["event_type"]>([
    "ConversationStarted",
    "ConversationRestarted",
    "ConversationQualified",
  ]);

  const alias = await resolveWorkspaceAliasForIncomingWorkspaceId(supabase, envelope.workspace_id);
  if (!alias) {
    return {
      alias: null,
      commandsEnqueued: 0,
      deferred: false,
    };
  }

  try {
    await recordPlatformEvent(supabase, alias, envelope);

    const contract = validatePlatformEventContract(envelope);
    if (!contract.ok) {
      await updatePlatformEventStatus(supabase, envelope.event_id, alias.tenant_id, "failed", contract.message);
      return {
        alias,
        commandsEnqueued: 0,
        deferred: true,
      };
    }

    const commands = derivePlatformCommandsFromEvent(envelope);
    let deferred = false;
    for (const command of commands) {
      const storedCommand = await enqueuePlatformCommand(supabase, alias, command);
      if (storedCommand.delivery_status === "acked") {
        continue;
      }

      const attemptCount = storedCommand.attempt_count + 1;
      try {
        await executePlatformCommand(supabase, alias, storedCommand.envelope);
        await updatePlatformCommandStatus(supabase, {
          commandId: storedCommand.envelope.command_id,
          tenantId: alias.tenant_id,
          status: "acked",
          attemptCount,
        });
      } catch (commandError) {
        const commandMessage =
          commandError instanceof Error ? commandError.message : "Failed to execute platform command.";
        await updatePlatformCommandStatus(supabase, {
          commandId: storedCommand.envelope.command_id,
          tenantId: alias.tenant_id,
          status: "failed",
          lastError: commandMessage,
          attemptCount,
        });
        if (!nonFatalLifecycleEvents.has(envelope.event_type)) {
          throw commandError;
        }
        deferred = true;
      }
    }

    if (deferred) {
      await updatePlatformEventStatus(supabase, envelope.event_id, alias.tenant_id, "failed", "Deferred for replay.");
    } else {
      await updatePlatformEventStatus(supabase, envelope.event_id, alias.tenant_id, "processed");
      await sendPlatformLeadAlertBestEffort(supabase, alias, envelope);
    }

    return {
      alias,
      commandsEnqueued: commands.length,
      deferred,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process platform event.";
    if (nonFatalLifecycleEvents.has(envelope.event_type)) {
      await updatePlatformEventStatus(supabase, envelope.event_id, alias.tenant_id, "failed", message).catch(() => undefined);
      return {
        alias,
        commandsEnqueued: 0,
        deferred: true,
      };
    }
    await updatePlatformEventStatus(supabase, envelope.event_id, alias.tenant_id, "failed", message).catch(() => undefined);
    throw error;
  }
}
