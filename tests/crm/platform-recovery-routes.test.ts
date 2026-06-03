import { describe, expect, it, vi } from "vitest";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const eventId = "22222222-2222-4222-8222-222222222222";
const outboxId = "33333333-3333-4333-8333-333333333333";
const commandId = "66666666-6666-4666-8666-666666666666";

const envelope: PlatformEventEnvelope = {
  event_id: eventId,
  event_type: "BookingConfirmed",
  event_version: 1,
  workspace_id: "44444444-4444-4444-8444-444444444444",
  occurred_at: "2026-06-03T10:00:00.000Z",
  source_system: "agentic_runtime",
  idempotency_key: "conversation-1:booked:booking-1",
  correlation_id: null,
  causation_id: null,
  aggregate: {
    type: "conversation",
    id: "55555555-5555-4555-8555-555555555555",
  },
  payload: {},
};

async function mockManagerAuth() {
  vi.doMock("@/modules/crm/lib/api", async () => {
    const actual = await vi.importActual<typeof import("@/modules/crm/lib/api")>("@/modules/crm/lib/api");
    return {
      ...actual,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: {
          supabase: {},
          tenant,
        },
      }),
    };
  });
}

describe("platform recovery routes", () => {
  it("lists failed events, commands, and outbox events for managers", async () => {
    vi.resetModules();
    await mockManagerAuth();

    const listFailedPlatformEvents = vi.fn().mockResolvedValue([{ envelope }]);
    const listFailedPlatformCommands = vi.fn().mockResolvedValue([{ envelope: { command_id: "cmd-1" } }]);
    const listFailedPlatformOutboxEvents = vi.fn().mockResolvedValue([{ id: outboxId }]);

    vi.doMock("@/modules/platform/lib/repository", () => ({
      listFailedPlatformEvents,
      listFailedPlatformCommands,
      listFailedPlatformOutboxEvents,
    }));

    const route = await import("@/app/api/crm/platform/recovery/route");
    const response = (await route.GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.events).toHaveLength(1);
    expect(body.commands).toHaveLength(1);
    expect(body.outbox).toHaveLength(1);
    expect(listFailedPlatformEvents).toHaveBeenCalledWith({}, tenant.id, 50);
  });

  it("replays a failed platform event through the processor", async () => {
    vi.resetModules();
    await mockManagerAuth();

    const getPlatformEventById = vi.fn().mockResolvedValue({
      processing_status: "failed",
      envelope,
    });
    const processPlatformEvent = vi.fn().mockResolvedValue({ deferred: false, commandsEnqueued: 2 });

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformEventById,
    }));
    vi.doMock("@/modules/platform/lib/processor", () => ({
      processPlatformEvent,
    }));

    const route = await import("@/app/api/crm/platform/recovery/events/[eventId]/replay/route");
    const response = (await route.POST(new Request("http://localhost"), {
      params: Promise.resolve({ eventId }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(processPlatformEvent).toHaveBeenCalledWith({}, envelope);
  });

  it("rejects replay for dead-lettered platform events", async () => {
    vi.resetModules();
    await mockManagerAuth();

    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformEventById: vi.fn().mockResolvedValue({
        processing_status: "dead_letter",
        envelope,
      }),
    }));
    vi.doMock("@/modules/platform/lib/processor", () => ({
      processPlatformEvent: vi.fn(),
    }));

    const route = await import("@/app/api/crm/platform/recovery/events/[eventId]/replay/route");
    const response = (await route.POST(new Request("http://localhost"), {
      params: Promise.resolve({ eventId }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Dead-lettered platform events cannot be replayed.");
  });

  it("dead-letters failed platform events with an operator reason", async () => {
    vi.resetModules();
    await mockManagerAuth();

    const markPlatformEventDeadLetter = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformEventById: vi.fn().mockResolvedValue({
        processing_status: "failed",
        envelope,
      }),
      markPlatformEventDeadLetter,
    }));

    const route = await import("@/app/api/crm/platform/recovery/events/[eventId]/dead-letter/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "Operator confirmed this event is obsolete." }),
      }),
      { params: Promise.resolve({ eventId }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(markPlatformEventDeadLetter).toHaveBeenCalledWith(
      {},
      {
        eventId,
        tenantId: tenant.id,
        reason: "Operator confirmed this event is obsolete.",
      },
    );
  });

  it("replays one selected outbox event", async () => {
    vi.resetModules();
    await mockManagerAuth();

    const publishPlatformOutboxEventById = vi.fn().mockResolvedValue({ attempted: 1, published: 1, failed: 0, skipped: false });
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      publishPlatformOutboxEventById,
    }));

    const route = await import("@/app/api/crm/platform/recovery/outbox/[outboxId]/replay/route");
    const response = (await route.POST(new Request("http://localhost"), {
      params: Promise.resolve({ outboxId }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.published).toBe(1);
    expect(publishPlatformOutboxEventById).toHaveBeenCalledWith(
      {},
      {
        tenantId: tenant.id,
        id: outboxId,
      },
    );
  });

  it("dead-letters failed outbox events with an operator reason", async () => {
    vi.resetModules();
    await mockManagerAuth();

    const markPlatformOutboxEventDeadLetter = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/modules/platform/lib/repository", () => ({
      getPlatformOutboxEventById: vi.fn().mockResolvedValue({
        publication_status: "failed",
        envelope,
      }),
      markPlatformOutboxEventDeadLetter,
    }));

    const route = await import("@/app/api/crm/platform/recovery/outbox/[outboxId]/dead-letter/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "Runtime endpoint retired before delivery." }),
      }),
      { params: Promise.resolve({ outboxId }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(markPlatformOutboxEventDeadLetter).toHaveBeenCalledWith(
      {},
      {
        id: outboxId,
        tenantId: tenant.id,
        reason: "Runtime endpoint retired before delivery.",
      },
    );
  });

  it("dead-letters failed commands with an operator reason", async () => {
    vi.resetModules();
    await mockManagerAuth();

    const markPlatformCommandDeadLetter = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/modules/platform/lib/repository", () => ({
      markPlatformCommandDeadLetter,
    }));

    const route = await import("@/app/api/crm/platform/recovery/commands/[commandId]/dead-letter/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "Command is obsolete after manual CRM repair." }),
      }),
      { params: Promise.resolve({ commandId }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(markPlatformCommandDeadLetter).toHaveBeenCalledWith(
      {},
      {
        commandId,
        tenantId: tenant.id,
        reason: "Command is obsolete after manual CRM repair.",
      },
    );
  });
});
