import { z } from "zod";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";

const stringValue = z.string().trim().min(1);
const nullableUuid = z.uuid().nullable().optional();

const bookingPayloadSchema = z
  .object({
    booking_start_at: z.string().datetime({ offset: true }).optional(),
    starts_at: z.string().datetime({ offset: true }).optional(),
    start_at: z.string().datetime({ offset: true }).optional(),
    booking_end_at: z.string().datetime({ offset: true }).optional(),
    ends_at: z.string().datetime({ offset: true }).optional(),
    end_at: z.string().datetime({ offset: true }).optional(),
    booking_slot_label: z.string().optional(),
    appointment_id: z.string().optional(),
    booking_id: z.string().optional(),
    treatmentType: z.string().optional(),
    service_name: z.string().optional(),
  })
  .passthrough()
  .superRefine((payload, ctx) => {
    const hasStart = Boolean(payload.booking_start_at || payload.starts_at || payload.start_at);
    const hasBookingRef = Boolean(payload.appointment_id || payload.booking_id);
    if (!hasStart && !hasBookingRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["booking_start_at"],
        message: "BookingConfirmed needs a booking start time or booking reference.",
      });
    }
  });

const missedCallPayloadSchema = z
  .object({
    from: z.string().optional(),
    customer_phone: z.string().optional(),
    identity_phone: z.string().optional(),
  })
  .passthrough()
  .superRefine((payload, ctx) => {
    if (!payload.from && !payload.customer_phone && !payload.identity_phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "MissedCallCaptured needs a caller phone number.",
      });
    }
  });

const escalationPayloadSchema = z
  .object({
    trigger: z.string().optional(),
    reason: z.string().optional(),
    response_text: z.string().optional(),
    message_summary: z.string().optional(),
  })
  .passthrough()
  .superRefine((payload, ctx) => {
    if (!payload.trigger && !payload.reason && !payload.response_text && !payload.message_summary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "EscalationRaised needs a reason, trigger, or summary.",
      });
    }
  });

const customerPromiseChangedSchema = z
  .object({
    promise_id: z.uuid(),
    customer_id: nullableUuid,
    lead_id: nullableUuid,
    job_id: nullableUuid,
    quote_id: nullableUuid,
    invoice_id: nullableUuid,
    platform_conversation_id: z.string().nullable().optional(),
    title: stringValue,
    status: z.enum(["open", "completed", "cancelled"]),
    due_at: z.string().datetime({ offset: true }).nullable().optional(),
    channel: z.enum(["phone", "email", "sms", "whatsapp", "webchat", "voice", "office", "other"]),
    origin: z.enum(["office", "ai", "system"]),
  })
  .passthrough()
  .superRefine((payload, ctx) => {
    const hasLink = Boolean(
      payload.customer_id ||
        payload.lead_id ||
        payload.job_id ||
        payload.quote_id ||
        payload.invoice_id ||
        payload.platform_conversation_id,
    );
    if (!hasLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customer_id"],
        message: "CustomerPromiseChanged needs a linked customer, CRM record, or platform conversation.",
      });
    }
  });

export type PlatformEventContractResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      issues: Array<{
        path: Array<PropertyKey>;
        message: string;
      }>;
    };

export function validatePlatformEventContract(envelope: PlatformEventEnvelope): PlatformEventContractResult {
  const schema = schemaForEvent(envelope.event_type);
  if (!schema) {
    return { ok: true };
  }

  const parsed = schema.safeParse(envelope.payload);
  if (parsed.success) {
    return { ok: true };
  }

  return {
    ok: false,
    message: `Invalid ${envelope.event_type} payload.`,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })),
  };
}

function schemaForEvent(eventType: PlatformEventEnvelope["event_type"]) {
  switch (eventType) {
    case "BookingConfirmed":
      return bookingPayloadSchema;
    case "MissedCallCaptured":
      return missedCallPayloadSchema;
    case "EscalationRaised":
      return escalationPayloadSchema;
    case "CustomerPromiseChanged":
      return customerPromiseChangedSchema;
    default:
      return null;
  }
}
