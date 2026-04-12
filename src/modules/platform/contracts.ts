import { z } from "zod";

export const platformCommandTypes = [
  "CreateOrUpdateLeadFromConversation",
  "MatchCustomerByChannelIdentity",
  "CreateCallbackTask",
  "CreateOrUpdateAppointment",
  "CreateEscalationTask",
  "LinkConversationToCustomerOrJob",
] as const;
export type PlatformCommandType = (typeof platformCommandTypes)[number];

export const platformEventTypes = [
  "MissedCallCaptured",
  "ConversationStarted",
  "ConversationRestarted",
  "ConversationQualified",
  "BookingRequested",
  "BookingConfirmed",
  "AutomationDispatched",
  "EscalationRaised",
  "DeliveryStatusUpdated",
  "CustomerUpdated",
  "JobCreated",
  "JobRescheduled",
  "QuoteAccepted",
  "InvoiceOverdue",
  "WorkspaceSettingsChanged",
] as const;
export type PlatformEventType = (typeof platformEventTypes)[number];

export const platformSourceSystems = ["agentic_runtime", "crm"] as const;
export type PlatformSourceSystem = (typeof platformSourceSystems)[number];
export const platformTargetSystems = platformSourceSystems;
export type PlatformTargetSystem = (typeof platformTargetSystems)[number];

export const platformEventProcessingStatuses = ["accepted", "processed", "failed", "ignored"] as const;
export type PlatformEventProcessingStatus = (typeof platformEventProcessingStatuses)[number];

export const platformCommandDeliveryStatuses = ["pending", "sent", "acked", "failed", "dead_letter"] as const;
export type PlatformCommandDeliveryStatus = (typeof platformCommandDeliveryStatuses)[number];

export const platformCommandTypeSchema = z.enum(platformCommandTypes);
export const platformEventTypeSchema = z.enum(platformEventTypes);
export const platformSourceSystemSchema = z.enum(platformSourceSystems);
export const platformTargetSystemSchema = z.enum(platformTargetSystems);
export const platformEventProcessingStatusSchema = z.enum(platformEventProcessingStatuses);
export const platformCommandDeliveryStatusSchema = z.enum(platformCommandDeliveryStatuses);

export const platformEventEnvelopeSchema = z.object({
  event_id: z.uuid(),
  event_type: platformEventTypeSchema,
  event_version: z.number().int().min(1),
  workspace_id: z.uuid(),
  occurred_at: z.string().datetime({ offset: true }),
  source_system: platformSourceSystemSchema,
  idempotency_key: z.string().min(1),
  correlation_id: z.uuid().nullable().optional(),
  causation_id: z.uuid().nullable().optional(),
  aggregate: z.object({
    type: z.string().min(1),
    id: z.uuid().nullable().optional(),
  }),
  payload: z.record(z.string(), z.unknown()),
});

export type PlatformEventEnvelope = z.infer<typeof platformEventEnvelopeSchema>;

export const platformCommandEnvelopeSchema = z.object({
  command_id: z.uuid(),
  command_type: platformCommandTypeSchema,
  command_version: z.number().int().min(1),
  workspace_id: z.uuid(),
  issued_at: z.string().datetime({ offset: true }),
  source_system: platformSourceSystemSchema,
  target_system: platformTargetSystemSchema,
  idempotency_key: z.string().min(1),
  correlation_id: z.uuid().nullable().optional(),
  causation_id: z.uuid().nullable().optional(),
  aggregate: z.object({
    type: z.string().min(1),
    id: z.uuid().nullable().optional(),
  }),
  payload: z.record(z.string(), z.unknown()),
});

export type PlatformCommandEnvelope = z.infer<typeof platformCommandEnvelopeSchema>;
