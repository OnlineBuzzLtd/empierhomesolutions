import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

describe("customer promises API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lists open promises with tenant CRM mode filters", async () => {
    const listCustomerPromises = vi.fn().mockResolvedValue([{ id: "promise-1", title: "Call back" }]);
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      jsonError,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live" }),
    }));
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      listCustomerPromises,
      createCustomerPromiseWithClient: vi.fn(),
    }));

    const route = await import("@/app/api/crm/promises/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/promises?leadId=lead-1&limit=250"))) as Response;
    const body = await response.json();

    expect(body).toEqual({ ok: true, promises: [{ id: "promise-1", title: "Call back" }] });
    expect(listCustomerPromises).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-1", status: "open", limit: 100 }),
      "live",
    );
  });

  it("creates a tenant-scoped promise for the authenticated user", async () => {
    const createCustomerPromiseWithClient = vi.fn().mockResolvedValue({ id: "promise-1" });
    const supabase = { schema: vi.fn() };
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      jsonError,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      listCustomerPromises: vi.fn(),
      createCustomerPromiseWithClient,
    }));

    const route = await import("@/app/api/crm/promises/route");
    const response = (await route.POST!(
      new Request("http://localhost/api/crm/promises", {
        method: "POST",
        body: JSON.stringify({
          customer_id: "11111111-1111-4111-8111-111111111111",
          title: "Call customer",
          due_at: "2026-06-25T10:00:00.000Z",
          channel: "phone",
        }),
      }),
    )) as Response;

    expect(await response.json()).toEqual({ ok: true, promise: { id: "promise-1" } });
    expect(createCustomerPromiseWithClient).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenant_id: "tenant-1",
        customer_id: "11111111-1111-4111-8111-111111111111",
        title: "Call customer",
        created_by: "user-1",
        updated_by: "user-1",
      }),
    );
  });

  it("updates an existing promise by id", async () => {
    const updateCustomerPromiseWithClient = vi.fn().mockResolvedValue({ id: "promise-1", status: "completed" });
    const supabase = { schema: vi.fn() };
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      jsonError,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/customer-promises", () => ({
      updateCustomerPromiseWithClient,
    }));

    const route = await import("@/app/api/crm/promises/[id]/route");
    const response = (await route.PATCH!(
      new Request("http://localhost/api/crm/promises/promise-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      }),
      { params: Promise.resolve({ id: "promise-1" }) },
    )) as Response;

    expect(await response.json()).toEqual({ ok: true, promise: { id: "promise-1", status: "completed" } });
    expect(updateCustomerPromiseWithClient).toHaveBeenCalledWith(
      supabase,
      "tenant-1",
      "promise-1",
      expect.objectContaining({ status: "completed", updated_by: "user-1" }),
    );
  });
});
