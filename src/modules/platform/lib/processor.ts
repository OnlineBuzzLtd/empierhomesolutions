import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";
import { executePlatformCommand } from "@/modules/platform/lib/command-executor";
import { derivePlatformCommandsFromEvent } from "@/modules/platform/lib/integration";
import {
  enqueuePlatformCommand,
  recordPlatformEvent,
  resolveWorkspaceAliasForIncomingWorkspaceId,
  updatePlatformCommandStatus,
  updatePlatformEventStatus,
} from "@/modules/platform/lib/repository";

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

    const commands = derivePlatformCommandsFromEvent(envelope);
    let deferred = false;
    for (const command of commands) {
      const storedCommand = await enqueuePlatformCommand(supabase, alias, command);
      if (storedCommand.delivery_status === "acked") {
        continue;
      }

      try {
        await executePlatformCommand(supabase, alias, storedCommand.envelope);
        await updatePlatformCommandStatus(supabase, {
          commandId: storedCommand.envelope.command_id,
          tenantId: alias.tenant_id,
          status: "acked",
        });
      } catch (commandError) {
        const commandMessage =
          commandError instanceof Error ? commandError.message : "Failed to execute platform command.";
        await updatePlatformCommandStatus(supabase, {
          commandId: storedCommand.envelope.command_id,
          tenantId: alias.tenant_id,
          status: "failed",
          lastError: commandMessage,
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
