import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PlatformEventEnvelope } from "@/modules/platform/contracts";

const envelope: PlatformEventEnvelope = {
  event_id: "11111111-1111-4111-8111-111111111111",
  event_type: "CustomerUpdated",
  event_version: 1,
  workspace_id: "22222222-2222-4222-8222-222222222222",
  occurred_at: "2026-06-03T10:00:00.000Z",
  source_system: "crm",
  idempotency_key: "customer:customer-1:updated:2026-06-03T10:00:00.000Z",
  correlation_id: null,
  causation_id: null,
  aggregate: {
    type: "customer",
    id: "33333333-3333-4333-8333-333333333333",
  },
  payload: {
    customer_id: "33333333-3333-4333-8333-333333333333",
    full_name: "Jane Smith",
  },
};

function expectedSignature(secret: string, timestamp: string, rawBody: string) {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

describe("platform outbox publisher", () => {
  it("publishes pending events with HMAC headers while preserving the legacy shared-secret header", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:34:56.000Z"));

    const markPublished = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    vi.doMock("@/modules/platform/lib/repository", () => ({
      listReadyPlatformOutboxEvents: vi.fn().mockResolvedValue([
        {
          id: envelope.event_id,
          tenant_id: "tenant-1",
          publication_status: "pending",
          occurred_at: envelope.occurred_at,
          published_at: null,
          delivery_attempt_count: 2,
          last_error: null,
          envelope,
        },
      ]),
      markPlatformOutboxEventPublished: markPublished,
      markPlatformOutboxEventFailed: markFailed,
      getPlatformOutboxEventById: vi.fn(),
      enqueuePlatformOutboxEvent: vi.fn(),
      getWorkspaceAlias: vi.fn(),
    }));

    const { publishPendingPlatformOutboxEvents } = await import("@/modules/platform/lib/outbox");

    const result = await publishPendingPlatformOutboxEvents({} as never, {
      webhookUrl: "https://platform.example.com/events",
      sharedSecret: "platform-secret",
      fetchFn,
    });

    const body = JSON.stringify(envelope);
    const headers = fetchFn.mock.calls[0]?.[1]?.headers as Record<string, string>;

    expect(result).toEqual({ attempted: 1, published: 1, failed: 0, skipped: false });
    expect(fetchFn).toHaveBeenCalledWith("https://platform.example.com/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-timestamp": "1780490096",
        "x-platform-signature": expectedSignature("platform-secret", "1780490096", body),
        "x-platform-shared-secret": "platform-secret",
      },
      body,
    });
    expect(headers["x-platform-signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(markPublished).toHaveBeenCalledWith(
      {},
      {
        id: envelope.event_id,
        tenantId: "tenant-1",
        publishedAt: "2026-06-03T12:34:56.000Z",
        deliveryAttemptCount: 3,
      },
    );
    expect(markFailed).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("marks an event failed when the signed publish request is rejected", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:34:56.000Z"));

    const markPublished = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue(new Response("bad signature", { status: 401 }));

    vi.doMock("@/modules/platform/lib/repository", () => ({
      listReadyPlatformOutboxEvents: vi.fn().mockResolvedValue([
        {
          id: envelope.event_id,
          tenant_id: "tenant-1",
          publication_status: "pending",
          occurred_at: envelope.occurred_at,
          published_at: null,
          delivery_attempt_count: 0,
          last_error: null,
          envelope,
        },
      ]),
      markPlatformOutboxEventPublished: markPublished,
      markPlatformOutboxEventFailed: markFailed,
      getPlatformOutboxEventById: vi.fn(),
      enqueuePlatformOutboxEvent: vi.fn(),
      getWorkspaceAlias: vi.fn(),
    }));

    const { publishPendingPlatformOutboxEvents } = await import("@/modules/platform/lib/outbox");

    const result = await publishPendingPlatformOutboxEvents({} as never, {
      webhookUrl: "https://platform.example.com/events",
      sharedSecret: "platform-secret",
      fetchFn,
    });

    expect(result).toEqual({ attempted: 1, published: 0, failed: 1, skipped: false });
    expect(markPublished).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(
      {},
      {
        id: envelope.event_id,
        tenantId: "tenant-1",
        errorMessage: "Platform event publish failed with status 401: bad signature",
        deliveryAttemptCount: 1,
      },
    );

    vi.useRealTimers();
  });

  it("replays one selected outbox event by id", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:34:56.000Z"));

    const markPublished = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    vi.doMock("@/modules/platform/lib/repository", () => ({
      listReadyPlatformOutboxEvents: vi.fn(),
      getPlatformOutboxEventById: vi.fn().mockResolvedValue({
        id: envelope.event_id,
        tenant_id: "tenant-1",
        publication_status: "failed",
        occurred_at: envelope.occurred_at,
        published_at: null,
        delivery_attempt_count: 1,
        last_error: "network timeout",
        dead_letter_reason: null,
        envelope,
      }),
      markPlatformOutboxEventPublished: markPublished,
      markPlatformOutboxEventFailed: markFailed,
      enqueuePlatformOutboxEvent: vi.fn(),
      getWorkspaceAlias: vi.fn(),
    }));

    const { publishPlatformOutboxEventById } = await import("@/modules/platform/lib/outbox");

    const result = await publishPlatformOutboxEventById({} as never, {
      tenantId: "tenant-1",
      id: envelope.event_id,
      dependencies: {
        webhookUrl: "https://platform.example.com/events",
        sharedSecret: "platform-secret",
        fetchFn,
      },
    });

    expect(result).toEqual({ attempted: 1, published: 1, failed: 0, skipped: false });
    expect(markPublished).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: envelope.event_id,
        tenantId: "tenant-1",
        deliveryAttemptCount: 2,
      }),
    );

    vi.useRealTimers();
  });
});
