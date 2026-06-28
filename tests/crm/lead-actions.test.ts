import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

describe("lead worklist actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("claims an enquiry for the current CRM user", async () => {
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      single: vi.fn().mockResolvedValue({ data: { id: "lead-1", assigned_to: "user-1" }, error: null }),
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => updateChain),
      })),
    };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      createCustomerPromiseWithClient: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/[id]/actions/route");
    const response = (await route.POST!(
      new Request("http://localhost/api/crm/leads/lead-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "claim" }),
      }),
      { params: Promise.resolve({ id: "lead-1" }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith({ assigned_to: "user-1" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "lead-1");
  });

  it("snoozes an enquiry and claims ownership for the current CRM user", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T08:00:00.000Z"));
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "lead-1",
          customer_id: "customer-1",
          assigned_to: "user-1",
          next_action_at: "2026-06-25T10:00:00.000Z",
          problem_description: "Boiler leaking.",
          notes: null,
          is_demo: false,
          demo_scenario_key: null,
          customer: { id: "customer-1", phone: "07777123456", email: null },
        },
        error: null,
      }),
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => updateChain),
      })),
    };

    const createCustomerPromiseWithClient = vi.fn().mockResolvedValue({ id: "promise-1" });
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      createCustomerPromiseWithClient,
    }));

    const route = await import("@/app/api/crm/leads/[id]/actions/route");
    const response = (await route.POST!(
      new Request("http://localhost/api/crm/leads/lead-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "snooze", preset: "later_today" }),
      }),
      { params: Promise.resolve({ id: "lead-1" }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith({
      assigned_to: "user-1",
      next_action_at: "2026-06-25T10:00:00.000Z",
      status: "follow_up",
    });
    expect(createCustomerPromiseWithClient).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenant_id: "tenant-1",
        customer_id: "customer-1",
        lead_id: "lead-1",
        owner_user_id: "user-1",
        due_at: "2026-06-25T10:00:00.000Z",
        channel: "phone",
        idempotency_key: "lead:lead-1:next_action:2026-06-25T10:00:00.000Z",
      }),
    );
  });

  it("supports longer follow-up presets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T08:00:00.000Z"));
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(() => updateChain),
      select: vi.fn(() => updateChain),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "lead-1",
          customer_id: null,
          assigned_to: "user-1",
          next_action_at: "2026-07-02T09:00:00.000Z",
          problem_description: null,
          notes: null,
          is_demo: false,
          demo_scenario_key: null,
          customer: null,
        },
        error: null,
      }),
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => updateChain),
      })),
    };

    const createCustomerPromiseWithClient = vi.fn().mockResolvedValue({ id: "promise-1" });
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      createCustomerPromiseWithClient,
    }));

    const route = await import("@/app/api/crm/leads/[id]/actions/route");
    const response = (await route.POST!(
      new Request("http://localhost/api/crm/leads/lead-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "snooze", preset: "next_week" }),
      }),
      { params: Promise.resolve({ id: "lead-1" }) },
    )) as Response;

    expect(response.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith({
      assigned_to: "user-1",
      next_action_at: "2026-07-02T09:00:00.000Z",
      status: "follow_up",
    });
    expect(createCustomerPromiseWithClient).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenant_id: "tenant-1",
        lead_id: "lead-1",
        due_at: "2026-07-02T09:00:00.000Z",
        channel: "office",
      }),
    );
  });

  it("rejects invalid lead actions", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      createCustomerPromiseWithClient: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/[id]/actions/route");
    const response = (await route.POST!(
      new Request("http://localhost/api/crm/leads/lead-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "delete_everything" }),
      }),
      { params: Promise.resolve({ id: "lead-1" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid lead action.");
  });
});
