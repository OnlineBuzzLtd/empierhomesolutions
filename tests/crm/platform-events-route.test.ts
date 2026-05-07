import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

function computeSignature(secret: string, timestamp: string, rawBody: string) {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

describe("platform events route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.each([
    {
      name: "missed call recovery",
      eventType: "MissedCallCaptured",
      payload: {
        from: "+447700900111",
        call_sid: "CA123",
        call_status: "no-answer",
      },
      expectedCommandTypes: ["CreateCallbackTask"],
    },
    {
      name: "conversation start matching",
      eventType: "ConversationStarted",
      payload: {
        channel: "sms",
        identity_phone: "+447700900111",
        message_summary: "Customer asked about a boiler fault.",
      },
      expectedCommandTypes: ["MatchCustomerByChannelIdentity", "LinkConversationToCustomerOrJob"],
    },
    {
      name: "lead qualification",
      eventType: "ConversationQualified",
      payload: {
        channel: "webchat",
        message_summary: "Customer is ready to book.",
      },
      expectedCommandTypes: ["CreateOrUpdateLeadFromConversation"],
    },
    {
      name: "booking confirmation",
      eventType: "BookingConfirmed",
      payload: {
        booking_start_at: "2026-04-07T11:00:00.000Z",
        booking_end_at: "2026-04-07T12:00:00.000Z",
        booking_slot_label: "Tue 11:00-12:00",
      },
      expectedCommandTypes: ["CreateOrUpdateAppointment", "LinkConversationToCustomerOrJob"],
    },
    {
      name: "escalation handling",
      eventType: "EscalationRaised",
      payload: {
        trigger: "gas_smell",
        response_text: "Please call emergency support now.",
      },
      expectedCommandTypes: ["CreateEscalationTask"],
    },
  ])(
    "processes $name events into the expected CRM commands",
    async ({ eventType, payload, expectedCommandTypes }) => {
      const alias = {
        workspace_id: "22222222-2222-4222-8222-222222222222",
        tenant_id: "11111111-1111-4111-8111-111111111111",
        created_at: "2026-04-07T10:00:00.000Z",
        updated_at: "2026-04-07T10:00:00.000Z",
      };
      const recordPlatformEvent = vi.fn().mockResolvedValue(undefined);
      const resolveWorkspaceAliasForIncomingWorkspaceId = vi.fn().mockResolvedValue(alias);
      const updatePlatformCommandStatus = vi.fn().mockResolvedValue(undefined);
      const updatePlatformEventStatus = vi.fn().mockResolvedValue(undefined);
      const executePlatformCommand = vi.fn().mockResolvedValue(undefined);
      const enqueuePlatformCommand = vi.fn().mockImplementation(async (_supabase, _alias, envelope) => ({
        tenant_id: alias.tenant_id,
        delivery_status: "pending",
        requested_by_user_id: null,
        sent_at: null,
        acknowledged_at: null,
        last_error: null,
        attempt_count: 0,
        envelope,
      }));

      vi.doMock("@/modules/crm/lib/env", () => ({
        getCrmEnv: vi.fn().mockReturnValue({
          platformSharedSecret: "test-secret",
        }),
      }));
      vi.doMock("@/modules/crm/lib/supabase-server", () => ({
        createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
      }));
      vi.doMock("@/modules/platform/lib/repository", () => ({
        enqueuePlatformCommand,
        resolveWorkspaceAliasForIncomingWorkspaceId,
        recordPlatformEvent,
        updatePlatformCommandStatus,
        updatePlatformEventStatus,
      }));
      vi.doMock("@/modules/platform/lib/command-executor", () => ({
        executePlatformCommand,
      }));

      const route = await import("@/app/api/platform/events/route");
      const response = await route.POST(
        new Request("http://localhost/api/platform/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-platform-shared-secret": "test-secret",
          },
          body: JSON.stringify({
            event_id: "aaaaaaaa-1111-4111-8111-111111111111",
            event_type: eventType,
            event_version: 1,
            workspace_id: alias.workspace_id,
            occurred_at: "2026-04-07T10:00:00.000Z",
            source_system: "agentic_runtime",
            idempotency_key: `scenario:${eventType}`,
            correlation_id: null,
            causation_id: null,
            aggregate: {
              type: "conversation",
              id: "bbbbbbbb-2222-4222-8222-222222222222",
            },
            payload,
          }),
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.commands_enqueued).toBe(expectedCommandTypes.length);
      expect(recordPlatformEvent).toHaveBeenCalledTimes(1);
      expect(resolveWorkspaceAliasForIncomingWorkspaceId).toHaveBeenCalledWith({}, alias.workspace_id);
      expect(enqueuePlatformCommand.mock.calls.map(([, , envelope]) => envelope.command_type)).toEqual(
        expect.arrayContaining(expectedCommandTypes),
      );
      expect(enqueuePlatformCommand).toHaveBeenCalledTimes(expectedCommandTypes.length);
      expect(executePlatformCommand).toHaveBeenCalledTimes(expectedCommandTypes.length);
      expect(updatePlatformCommandStatus).toHaveBeenCalledTimes(expectedCommandTypes.length);
      expect(updatePlatformEventStatus).toHaveBeenCalledWith(
        {},
        "aaaaaaaa-1111-4111-8111-111111111111",
        alias.tenant_id,
        "processed",
      );
    },
  );

  it("rejects requests with the wrong shared secret", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        platformSharedSecret: "test-secret",
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn(),
    }));

    const route = await import("@/app/api/platform/events/route");
    const response = await route.POST(
      new Request("http://localhost/api/platform/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-platform-shared-secret": "wrong-secret",
        },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized.");
  });

  it("accepts requests signed with the HMAC headers without the legacy shared secret header", async () => {
    const alias = {
      workspace_id: "22222222-2222-4222-8222-222222222222",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-04-07T10:00:00.000Z",
      updated_at: "2026-04-07T10:00:00.000Z",
    };
    const recordPlatformEvent = vi.fn().mockResolvedValue(undefined);
    const resolveWorkspaceAliasForIncomingWorkspaceId = vi.fn().mockResolvedValue(alias);
    const updatePlatformCommandStatus = vi.fn().mockResolvedValue(undefined);
    const updatePlatformEventStatus = vi.fn().mockResolvedValue(undefined);
    const executePlatformCommand = vi.fn().mockResolvedValue(undefined);
    const enqueuePlatformCommand = vi.fn().mockImplementation(async (_supabase, _alias, envelope) => ({
      tenant_id: alias.tenant_id,
      delivery_status: "pending",
      requested_by_user_id: null,
      sent_at: null,
      acknowledged_at: null,
      last_error: null,
      attempt_count: 0,
      envelope,
    }));

    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        platformSharedSecret: "test-secret",
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/platform/lib/repository", () => ({
      enqueuePlatformCommand,
      resolveWorkspaceAliasForIncomingWorkspaceId,
      recordPlatformEvent,
      updatePlatformCommandStatus,
      updatePlatformEventStatus,
    }));
    vi.doMock("@/modules/platform/lib/command-executor", () => ({
      executePlatformCommand,
    }));

    const rawBody = JSON.stringify({
      event_id: "aaaaaaaa-1111-4111-8111-111111111111",
      event_type: "ConversationStarted",
      event_version: 1,
      workspace_id: alias.workspace_id,
      occurred_at: "2026-04-07T10:00:00.000Z",
      source_system: "agentic_runtime",
      idempotency_key: "scenario:hmac",
      correlation_id: null,
      causation_id: null,
      aggregate: {
        type: "conversation",
        id: "bbbbbbbb-2222-4222-8222-222222222222",
      },
      payload: {
        channel: "sms",
        identity_phone: "+447700900111",
      },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature("test-secret", timestamp, rawBody);

    const route = await import("@/app/api/platform/events/route");
    const response = await route.POST(
      new Request("http://localhost/api/platform/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-platform-timestamp": timestamp,
          "x-platform-signature": signature,
        },
        body: rawBody,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.auth).toBe("hmac");
    expect(recordPlatformEvent).toHaveBeenCalledTimes(1);
  });
});
