import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerPromise } from "@/modules/crm/types";

function promise(overrides: Partial<CustomerPromise> = {}): CustomerPromise {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "tenant-1",
    customer_id: "22222222-2222-4222-8222-222222222222",
    lead_id: null,
    job_id: null,
    quote_id: null,
    invoice_id: null,
    platform_conversation_id: null,
    platform_event_id: null,
    promise_type: "callback",
    title: "Call customer back",
    detail: "Customer asked for a callback.",
    owner_user_id: "33333333-3333-4333-8333-333333333333",
    due_at: "2026-06-25T10:00:00.000Z",
    channel: "phone",
    status: "open",
    origin: "office",
    idempotency_key: null,
    completed_at: null,
    created_by: "33333333-3333-4333-8333-333333333333",
    updated_by: "33333333-3333-4333-8333-333333333333",
    is_demo: false,
    demo_scenario_key: null,
    record_deleted_at: null,
    created_at: "2026-06-25T09:00:00.000Z",
    updated_at: "2026-06-25T09:00:00.000Z",
    ...overrides,
  };
}

function buildCreateSupabase(created: CustomerPromise) {
  const promiseInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    })),
  }));
  const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    auditInsert,
    promiseInsert,
    supabase: {
      schema: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === "customer_promises") return { insert: promiseInsert };
          if (table === "customer_promise_events") return { insert: auditInsert };
          throw new Error(`Unexpected table ${table}`);
        }),
      })),
    },
  };
}

function buildUpdateSupabase(updated: CustomerPromise) {
  const updateSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
  const promiseUpdate = vi.fn((patch: Record<string, unknown>) => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: updateSingle,
        })),
      })),
    })),
    patch,
  }));
  const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    auditInsert,
    promiseUpdate,
    supabase: {
      schema: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === "customer_promises") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(),
                  })),
                })),
              })),
              update: promiseUpdate,
            };
          }
          if (table === "customer_promise_events") return { insert: auditInsert };
          throw new Error(`Unexpected table ${table}`);
        }),
      })),
    },
  };
}

describe("customer promise audit and forward sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("records an audit row and CRM outbox event when creating a promise", async () => {
    const enqueueCrmPlatformEvent = vi.fn().mockResolvedValue({ id: "outbox-1" });
    vi.doMock("@/modules/platform/lib/outbox", () => ({ enqueueCrmPlatformEvent }));

    const created = promise();
    const { supabase, auditInsert } = buildCreateSupabase(created);
    const { createCustomerPromiseWithClient } = await import("@/modules/crm/lib/customer-promises");

    await createCustomerPromiseWithClient(supabase as never, {
      tenant_id: "tenant-1",
      customer_id: created.customer_id,
      title: created.title,
      updated_by: created.updated_by,
      created_by: created.created_by,
    });

    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: "tenant-1",
      promise_id: created.id,
      event_type: "created",
      next_status: "open",
    }));
    expect(enqueueCrmPlatformEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenantId: "tenant-1",
        eventType: "CustomerPromiseChanged",
        aggregateType: "customer_promise",
        aggregateId: created.id,
        idempotencyKey: `customer-promise:${created.id}:created:${created.updated_at}`,
      }),
    );
  });

  it("records completion changes and emits a completed sync event", async () => {
    const enqueueCrmPlatformEvent = vi.fn().mockResolvedValue({ id: "outbox-1" });
    const previous = promise({ status: "open", updated_at: "2026-06-25T09:00:00.000Z" });
    const updated = promise({
      status: "completed",
      completed_at: "2026-06-25T11:00:00.000Z",
      updated_at: "2026-06-25T11:00:00.000Z",
    });
    vi.doMock("@/modules/platform/lib/outbox", () => ({ enqueueCrmPlatformEvent }));
    vi.doMock("@/modules/crm/lib/data-runner", async () => {
      const actual = await vi.importActual<typeof import("@/modules/crm/lib/data-runner")>(
        "@/modules/crm/lib/data-runner",
      );
      return { ...actual, runCrmSingle: vi.fn().mockResolvedValue(previous) };
    });

    const { supabase, auditInsert, promiseUpdate } = buildUpdateSupabase(updated);
    const { updateCustomerPromiseWithClient } = await import("@/modules/crm/lib/customer-promises");

    await updateCustomerPromiseWithClient(supabase as never, "tenant-1", updated.id, {
      status: "completed",
      updated_by: updated.updated_by,
    });

    expect(promiseUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
      completed_at: expect.any(String),
    }));
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "completed",
      previous_status: "open",
      next_status: "completed",
      changes: expect.objectContaining({
        status: { from: "open", to: "completed" },
      }),
    }));
    expect(enqueueCrmPlatformEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        eventType: "CustomerPromiseChanged",
        idempotencyKey: `customer-promise:${updated.id}:completed:${updated.updated_at}`,
      }),
    );
  });
});
