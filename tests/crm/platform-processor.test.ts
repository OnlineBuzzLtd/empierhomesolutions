import { describe, expect, it, vi } from "vitest";

describe("platform event processor", () => {
  it("returns no alias when the workspace does not exist", async () => {
    vi.resetModules();
    vi.doMock("@/modules/platform/lib/repository", () => ({
      resolveWorkspaceAliasForIncomingWorkspaceId: vi.fn().mockResolvedValue(null),
    }));

    const { processPlatformEvent } = await import("@/modules/platform/lib/processor");

    const result = await processPlatformEvent(
      {} as never,
      {
        event_id: "11111111-1111-4111-8111-111111111111",
        event_type: "ConversationStarted",
        event_version: 1,
        workspace_id: "22222222-2222-4222-8222-222222222222",
        occurred_at: "2026-04-07T10:00:00.000Z",
        source_system: "agentic_runtime",
        idempotency_key: "processor:missing-alias",
        correlation_id: null,
        causation_id: null,
        aggregate: {
          type: "conversation",
          id: "33333333-3333-4333-8333-333333333333",
        },
        payload: {},
      },
    );

    expect(result.alias).toBeNull();
    expect(result.commandsEnqueued).toBe(0);
  });

  it("processes commands outside the HTTP route wrapper", async () => {
    vi.resetModules();

    const alias = {
      workspace_id: "22222222-2222-4222-8222-222222222222",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-04-07T10:00:00.000Z",
      updated_at: "2026-04-07T10:00:00.000Z",
    };

    const recordPlatformEvent = vi.fn().mockResolvedValue(undefined);
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
    const updatePlatformCommandStatus = vi.fn().mockResolvedValue(undefined);
    const updatePlatformEventStatus = vi.fn().mockResolvedValue(undefined);
    const executePlatformCommand = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      resolveWorkspaceAliasForIncomingWorkspaceId: vi.fn().mockResolvedValue(alias),
      recordPlatformEvent,
      enqueuePlatformCommand,
      updatePlatformCommandStatus,
      updatePlatformEventStatus,
    }));
    vi.doMock("@/modules/platform/lib/command-executor", () => ({
      executePlatformCommand,
    }));

    const { processPlatformEvent } = await import("@/modules/platform/lib/processor");

    const result = await processPlatformEvent(
      {} as never,
      {
        event_id: "11111111-1111-4111-8111-111111111111",
        event_type: "BookingConfirmed",
        event_version: 1,
        workspace_id: alias.workspace_id,
        occurred_at: "2026-04-07T10:00:00.000Z",
        source_system: "agentic_runtime",
        idempotency_key: "processor:booking",
        correlation_id: null,
        causation_id: null,
        aggregate: {
          type: "conversation",
          id: "33333333-3333-4333-8333-333333333333",
        },
        payload: {
          booking_start_at: "2026-04-07T11:00:00.000Z",
          booking_end_at: "2026-04-07T12:00:00.000Z",
          booking_slot_label: "Tue 11:00-12:00",
        },
      },
    );

    expect(result.alias).toEqual(alias);
    expect(result.commandsEnqueued).toBe(2);
    expect(result.deferred).toBe(false);
    expect(recordPlatformEvent).toHaveBeenCalledTimes(1);
    expect(executePlatformCommand).toHaveBeenCalledTimes(2);
    expect(updatePlatformCommandStatus).toHaveBeenCalledTimes(2);
    expect(updatePlatformEventStatus).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      alias.tenant_id,
      "processed",
      undefined,
    );
  });

  it("treats restart command failures as deferred instead of throwing", async () => {
    vi.resetModules();

    const alias = {
      workspace_id: "22222222-2222-4222-8222-222222222222",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-04-07T10:00:00.000Z",
      updated_at: "2026-04-07T10:00:00.000Z",
    };

    const recordPlatformEvent = vi.fn().mockResolvedValue(undefined);
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
    const updatePlatformCommandStatus = vi.fn().mockResolvedValue(undefined);
    const updatePlatformEventStatus = vi.fn().mockResolvedValue(undefined);
    const executePlatformCommand = vi.fn().mockRejectedValue(new Error("link failed"));

    vi.doMock("@/modules/platform/lib/repository", () => ({
      resolveWorkspaceAliasForIncomingWorkspaceId: vi.fn().mockResolvedValue(alias),
      recordPlatformEvent,
      enqueuePlatformCommand,
      updatePlatformCommandStatus,
      updatePlatformEventStatus,
    }));
    vi.doMock("@/modules/platform/lib/command-executor", () => ({
      executePlatformCommand,
    }));

    const { processPlatformEvent } = await import("@/modules/platform/lib/processor");

    const result = await processPlatformEvent(
      {} as never,
      {
        event_id: "11111111-1111-4111-8111-111111111111",
        event_type: "ConversationRestarted",
        event_version: 1,
        workspace_id: alias.workspace_id,
        occurred_at: "2026-04-07T10:00:00.000Z",
        source_system: "agentic_runtime",
        idempotency_key: "processor:restart",
        correlation_id: null,
        causation_id: null,
        aggregate: {
          type: "conversation",
          id: "33333333-3333-4333-8333-333333333333",
        },
        payload: {
          prior_session_id: "prior-session",
          restart_reason: "customer_restarted",
        },
      },
    );

    expect(result.alias).toEqual(alias);
    expect(result.deferred).toBe(true);
    expect(updatePlatformEventStatus).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      alias.tenant_id,
      "failed",
      "Deferred for replay.",
    );
  });
});
