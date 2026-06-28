import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

describe("CRM search API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns an empty result set for short queries without loading CRM lists", async () => {
    const listCustomers = vi.fn();
    const listLeadsStrict = vi.fn();
    const listJobs = vi.fn();
    const listQuotes = vi.fn();
    const listInvoices = vi.fn();

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      listCustomers,
      listLeadsStrict,
      listJobs,
      listQuotes,
      listInvoices,
    }));

    const route = await import("@/app/api/crm/search/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/search?q=a"))) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(listCustomers).not.toHaveBeenCalled();
    expect(listLeadsStrict).not.toHaveBeenCalled();
    expect(listJobs).not.toHaveBeenCalled();
    expect(listQuotes).not.toHaveBeenCalled();
    expect(listInvoices).not.toHaveBeenCalled();
  });

  it("searches existing CRM lists and returns grouped destinations", async () => {
    const listCustomers = vi.fn().mockResolvedValue([
      {
        id: "customer-1",
        full_name: "Boiler Customer",
        phone: "07777123456",
        email: null,
        postcode: "UB8 1AA",
        active_job_count: 1,
      },
    ]);
    const listLeadsStrict = vi.fn().mockResolvedValue([
      {
        id: "lead-1",
        status: "new",
        source: "Website",
        problem_description: "Boiler leaking.",
        notes: null,
        created_at: "2026-06-23T10:00:00.000Z",
        customer: { full_name: "Lead Customer", phone: "07111222333", email: null, postcode: null },
      },
    ]);
    const listJobs = vi.fn().mockResolvedValue([]);
    const listQuotes = vi.fn().mockResolvedValue([]);
    const listInvoices = vi.fn().mockResolvedValue([]);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      listCustomers,
      listLeadsStrict,
      listJobs,
      listQuotes,
      listInvoices,
    }));

    const route = await import("@/app/api/crm/search/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/search?q=boiler"))) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listCustomers).toHaveBeenCalledWith("live", { pageSize: 250 });
    expect(listLeadsStrict).toHaveBeenCalledWith("live", { pageSize: 250 }, "all");
    expect(body.items).toEqual([
      expect.objectContaining({ type: "customer", href: "/customers/customer-1" }),
      expect.objectContaining({ type: "enquiry", href: "/leads?tab=all&highlight=lead-1" }),
    ]);
  });
});
