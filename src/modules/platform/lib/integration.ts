import { randomUUID } from "node:crypto";
import {
  platformCommandEnvelopeSchema,
  type PlatformCommandEnvelope,
  type PlatformCommandType,
  type PlatformEventEnvelope,
} from "@/modules/platform/contracts";

function buildCommandFromEvent(
  event: PlatformEventEnvelope,
  commandType: PlatformCommandType,
  payload: Record<string, unknown>,
): PlatformCommandEnvelope {
  return platformCommandEnvelopeSchema.parse({
    command_id: randomUUID(),
    command_type: commandType,
    command_version: 1,
    workspace_id: event.workspace_id,
    issued_at: new Date().toISOString(),
    source_system: "crm",
    target_system: "crm",
    idempotency_key: `${event.event_id}:${commandType}`,
    correlation_id: event.correlation_id ?? event.event_id,
    causation_id: event.event_id,
    aggregate: {
      type: event.aggregate.type,
      id: event.aggregate.id ?? null,
    },
    payload,
  });
}

export function derivePlatformCommandsFromEvent(event: PlatformEventEnvelope): PlatformCommandEnvelope[] {
  if (event.source_system !== "agentic_runtime") {
    return [];
  }

  switch (event.event_type) {
    case "MissedCallCaptured":
      return [
        buildCommandFromEvent(event, "CreateCallbackTask", {
          recovery_reason: "missed_call",
          ...event.payload,
        }),
      ];
    case "ConversationStarted":
      return [
        buildCommandFromEvent(event, "MatchCustomerByChannelIdentity", {
          conversation_status: "started",
          ...event.payload,
        }),
        buildCommandFromEvent(event, "LinkConversationToCustomerOrJob", {
          link_reason: "conversation_started",
          ...event.payload,
        }),
      ];
    case "ConversationRestarted":
      return [
        buildCommandFromEvent(event, "MatchCustomerByChannelIdentity", {
          conversation_status: "restarted",
          ...event.payload,
        }),
        buildCommandFromEvent(event, "LinkConversationToCustomerOrJob", {
          link_reason: "conversation_restarted",
          ...event.payload,
        }),
      ];
    case "ConversationQualified":
      return [
        buildCommandFromEvent(event, "CreateOrUpdateLeadFromConversation", {
          qualification_status: "qualified",
          ...event.payload,
        }),
      ];
    case "BookingConfirmed":
      // Link first so the conversation has a customer_id before the appointment
      // runs, which lets CreateOrUpdateAppointment create a diary job on the
      // same pass instead of leaving it orphaned until a later event.
      return [
        buildCommandFromEvent(event, "LinkConversationToCustomerOrJob", {
          link_reason: "booking_confirmed",
          ...event.payload,
        }),
        buildCommandFromEvent(event, "CreateOrUpdateAppointment", {
          booking_status: "confirmed",
          ...event.payload,
        }),
      ];
    case "EscalationRaised":
      return [
        buildCommandFromEvent(event, "CreateEscalationTask", {
          escalation_status: "raised",
          ...event.payload,
        }),
      ];
    default:
      return [];
  }
}
