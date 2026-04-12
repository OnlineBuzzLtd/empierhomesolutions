import { describe, expect, it } from "vitest";
import {
  platformCommandEnvelopeSchema,
  platformCommandTypeSchema,
  platformEventEnvelopeSchema,
  platformEventTypeSchema,
} from "@/modules/platform/contracts";
import { selectLinkableJobForPayload } from "@/modules/platform/lib/command-executor";
import { derivePlatformCommandsFromEvent } from "@/modules/platform/lib/integration";
import { getPlatformConversationReviewState } from "@/modules/platform/lib/review";
import { buildWorkspaceModuleCards, toWorkspaceId } from "@/modules/platform/lib/workspace";

describe("crm platform helpers", () => {
  it("treats the tenant id as the current workspace id alias", () => {
    expect(toWorkspaceId(" 11111111-1111-4111-8111-111111111111 ")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("exposes the shared command and event vocabulary", () => {
    expect(platformCommandTypeSchema.parse("CreateCallbackTask")).toBe("CreateCallbackTask");
    expect(platformEventTypeSchema.parse("BookingConfirmed")).toBe("BookingConfirmed");
  });

  it("validates versioned workspace-scoped event envelopes", () => {
    const parsed = platformEventEnvelopeSchema.parse({
      event_id: "11111111-1111-4111-8111-111111111111",
      event_type: "ConversationStarted",
      event_version: 1,
      workspace_id: "22222222-2222-4222-8222-222222222222",
      occurred_at: "2026-03-30T10:00:00.000Z",
      source_system: "agentic_runtime",
      idempotency_key: "conversation-started:test",
      correlation_id: null,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: "33333333-3333-4333-8333-333333333333",
      },
      payload: {
        channel: "sms",
      },
    });

    expect(parsed.event_version).toBe(1);
    expect(parsed.workspace_id).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("validates versioned workspace-scoped command envelopes", () => {
    const parsed = platformCommandEnvelopeSchema.parse({
      command_id: "44444444-4444-4444-8444-444444444444",
      command_type: "CreateCallbackTask",
      command_version: 1,
      workspace_id: "22222222-2222-4222-8222-222222222222",
      issued_at: "2026-03-30T10:05:00.000Z",
      source_system: "crm",
      target_system: "crm",
      idempotency_key: "missed-call:test",
      correlation_id: "11111111-1111-4111-8111-111111111111",
      causation_id: "11111111-1111-4111-8111-111111111111",
      aggregate: {
        type: "conversation",
        id: "33333333-3333-4333-8333-333333333333",
      },
      payload: {
        recovery_reason: "missed_call",
      },
    });

    expect(parsed.command_type).toBe("CreateCallbackTask");
    expect(parsed.workspace_id).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("derives explicit CRM commands from agentic booking events", () => {
    const event = platformEventEnvelopeSchema.parse({
      event_id: "11111111-1111-4111-8111-111111111111",
      event_type: "BookingConfirmed",
      event_version: 1,
      workspace_id: "22222222-2222-4222-8222-222222222222",
      occurred_at: "2026-03-30T10:00:00.000Z",
      source_system: "agentic_runtime",
      idempotency_key: "booking-confirmed:test",
      correlation_id: null,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: "33333333-3333-4333-8333-333333333333",
      },
      payload: {
        appointment_id: "55555555-5555-4555-8555-555555555555",
      },
    });

    const commands = derivePlatformCommandsFromEvent(event);

    expect(commands.map((command) => command.command_type)).toEqual([
      "CreateOrUpdateAppointment",
      "LinkConversationToCustomerOrJob",
    ]);
    expect(commands[0]?.causation_id).toBe(event.event_id);
  });

  it("derives match and link commands from conversation start events", () => {
    const event = platformEventEnvelopeSchema.parse({
      event_id: "99999999-1111-4111-8111-111111111111",
      event_type: "ConversationStarted",
      event_version: 1,
      workspace_id: "22222222-2222-4222-8222-222222222222",
      occurred_at: "2026-03-30T10:00:00.000Z",
      source_system: "agentic_runtime",
      idempotency_key: "conversation-started:link-test",
      correlation_id: null,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: "33333333-3333-4333-8333-333333333333",
      },
      payload: {
        channel: "sms",
        identity_phone: "+447700900111",
      },
    });

    const commands = derivePlatformCommandsFromEvent(event);

    expect(commands.map((command) => command.command_type)).toEqual([
      "MatchCustomerByChannelIdentity",
      "LinkConversationToCustomerOrJob",
    ]);
  });

  it("derives restart-aware match and link commands from conversation restart events", () => {
    const event = platformEventEnvelopeSchema.parse({
      event_id: "99999999-1111-4111-8111-222222222222",
      event_type: "ConversationRestarted",
      event_version: 1,
      workspace_id: "22222222-2222-4222-8222-222222222222",
      occurred_at: "2026-03-30T10:15:00.000Z",
      source_system: "agentic_runtime",
      idempotency_key: "conversation-restarted:link-test",
      correlation_id: null,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: "33333333-3333-4333-8333-333333333333",
      },
      payload: {
        channel: "whatsapp",
        identity_phone: "+447700900111",
        prior_session_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        restart_reason: "greeting_restarted",
        returning_customer: true,
      },
    });

    const commands = derivePlatformCommandsFromEvent(event);

    expect(commands.map((command) => command.command_type)).toEqual([
      "MatchCustomerByChannelIdentity",
      "LinkConversationToCustomerOrJob",
    ]);
    expect(commands[0]?.payload.conversation_status).toBe("restarted");
    expect(commands[1]?.payload.link_reason).toBe("conversation_restarted");
  });

  it("selects a uniquely best job candidate from date and title hints", () => {
    const match = selectLinkableJobForPayload(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          customer_id: "customer-1",
          status: "booked",
          title: "Boiler service visit",
          scheduled_date: "2026-04-02",
          created_at: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          customer_id: "customer-1",
          status: "booked",
          title: "Consumer unit repair",
          scheduled_date: "2026-04-03",
          created_at: "2026-03-21T10:00:00.000Z",
        },
      ],
      {
        title: "Boiler service",
        booking_start_at: "2026-04-02T09:00:00.000Z",
      },
    );

    expect(match?.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("returns null when job matching is ambiguous", () => {
    const match = selectLinkableJobForPayload(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          customer_id: "customer-1",
          status: "booked",
          title: "Electrical inspection",
          scheduled_date: "2026-04-02",
          created_at: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          customer_id: "customer-1",
          status: "booked",
          title: "Electrical inspection",
          scheduled_date: "2026-04-02",
          created_at: "2026-03-19T10:00:00.000Z",
        },
      ],
      {
        title: "Electrical inspection",
        booking_start_at: "2026-04-02T11:00:00.000Z",
      },
    );

    expect(match).toBeNull();
  });

  it("builds native operator-shell module cards", () => {
    expect(buildWorkspaceModuleCards().map((item) => item.title)).toEqual([
      "Inbox",
      "Calls & Recovery",
      "Automations",
      "AI Settings",
    ]);
  });

  it("flags conversations with no CRM customer as review-needed", () => {
    const state = getPlatformConversationReviewState({
      link: {
        id: "link-1",
        workspace_id: "workspace-1",
        tenant_id: "tenant-1",
        conversation_id: "conversation-1",
        customer_id: null,
        lead_id: null,
        job_id: null,
        callback_appointment_id: null,
        booking_appointment_id: null,
        latest_channel: "sms",
        identity_phone: "+447700900111",
        identity_email: null,
        metadata: {},
        latest_event_at: "2026-03-30T10:00:00.000Z",
        created_at: "2026-03-30T10:00:00.000Z",
        updated_at: "2026-03-30T10:00:00.000Z",
      },
      customer: null,
      lead: null,
      job: null,
      callbackAppointment: null,
      bookingAppointment: null,
    });

    expect(state.needsReview).toBe(true);
    expect(state.priority).toBe("high");
    expect(state.reasons).toContain("No CRM customer linked");
  });

  it("flags booked conversations without jobs for review", () => {
    const state = getPlatformConversationReviewState({
      link: {
        id: "link-2",
        workspace_id: "workspace-1",
        tenant_id: "tenant-1",
        conversation_id: "conversation-2",
        customer_id: "customer-1",
        lead_id: "lead-1",
        job_id: null,
        callback_appointment_id: null,
        booking_appointment_id: "appt-1",
        latest_channel: "sms",
        identity_phone: null,
        identity_email: "jane@example.com",
        metadata: {},
        latest_event_at: "2026-03-30T10:00:00.000Z",
        created_at: "2026-03-30T10:00:00.000Z",
        updated_at: "2026-03-30T10:00:00.000Z",
      },
      customer: {
        id: "customer-1",
        full_name: "Jane Smith",
        phone: "07700900123",
        email: "jane@example.com",
        postcode: "SW1A 1AA",
      },
      lead: {
        id: "lead-1",
        status: "booked",
        source: "ai_platform",
        next_action_at: null,
        updated_at: "2026-03-30T10:00:00.000Z",
      },
      job: null,
      callbackAppointment: null,
      bookingAppointment: {
        id: "appt-1",
        type: "booking",
        title: "Boiler visit",
        starts_at: "2026-04-01T09:00:00.000Z",
        ends_at: "2026-04-01T10:00:00.000Z",
        status: "scheduled",
      },
    });

    expect(state.needsReview).toBe(true);
    expect(state.priority).toBe("medium");
    expect(state.reasons).toContain("Booking exists without a CRM job");
  });

  it("treats fully linked conversations as resolved", () => {
    const state = getPlatformConversationReviewState({
      link: {
        id: "link-3",
        workspace_id: "workspace-1",
        tenant_id: "tenant-1",
        conversation_id: "conversation-3",
        customer_id: "customer-1",
        lead_id: "lead-1",
        job_id: "job-1",
        callback_appointment_id: "appt-1",
        booking_appointment_id: "appt-2",
        latest_channel: "voice",
        identity_phone: "+447700900111",
        identity_email: null,
        metadata: {},
        latest_event_at: "2026-03-30T10:00:00.000Z",
        created_at: "2026-03-30T10:00:00.000Z",
        updated_at: "2026-03-30T10:00:00.000Z",
      },
      customer: {
        id: "customer-1",
        full_name: "Jane Smith",
        phone: "07700900123",
        email: "jane@example.com",
        postcode: "SW1A 1AA",
      },
      lead: {
        id: "lead-1",
        status: "booked",
        source: "ai_platform",
        next_action_at: null,
        updated_at: "2026-03-30T10:00:00.000Z",
      },
      job: {
        id: "job-1",
        title: "Boiler service",
        status: "booked",
        scheduled_date: "2026-04-01",
      },
      callbackAppointment: {
        id: "appt-1",
        type: "call",
        title: "Callback",
        starts_at: "2026-03-30T10:15:00.000Z",
        ends_at: "2026-03-30T10:30:00.000Z",
        status: "scheduled",
      },
      bookingAppointment: {
        id: "appt-2",
        type: "booking",
        title: "Boiler visit",
        starts_at: "2026-04-01T09:00:00.000Z",
        ends_at: "2026-04-01T10:00:00.000Z",
        status: "scheduled",
      },
    });

    expect(state.needsReview).toBe(false);
    expect(state.priority).toBeNull();
    expect(state.reasons).toEqual([]);
  });
});
