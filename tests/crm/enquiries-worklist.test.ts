import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

describe("enquiries worklist", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("defaults the leads API to the To-do enquiry filter and includes booking reviews in the count", async () => {
    const pagination = { page: 1, pageSize: 25 };
    const listLeads = vi.fn().mockResolvedValue([{ id: "lead-1" }]);
    const getEnquiryCounts = vi.fn().mockResolvedValue({ todoCount: 3, doneCount: 5, allCount: 8 });
    const listBookingRecoveryCases = vi.fn().mockResolvedValue([{ id: "booking-case-1" }]);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      paginationFromRequestUrl: vi.fn().mockReturnValue(pagination),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getEnquiryCounts,
      listCustomers: vi.fn().mockResolvedValue([]),
      listJobTypes: vi.fn().mockResolvedValue([]),
      listLeads,
      listServices: vi.fn().mockResolvedValue([]),
      listUserProfiles: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/platform/lib/booking-recovery", () => ({
      listBookingRecoveryCases,
    }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn((value) => value),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn(),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/leads"))) as Response;
    const body = await response.json();

    expect(listLeads).toHaveBeenCalledWith("live", pagination, "todo");
    expect(body.counts).toEqual({ todoCount: 4, doneCount: 5, allCount: 9 });
    expect(body.lookups).toEqual({ customers: [], services: [], jobTypes: [], engineers: [] });
    expect(body.recoveryCases).toHaveLength(1);
    expect(body.visibleCount).toBe(2);
  });

  it("uses the Done enquiry filter without showing unresolved booking reviews as rows", async () => {
    const pagination = { page: 1, pageSize: 25 };
    const listLeads = vi.fn().mockResolvedValue([{ id: "booked-lead-1" }]);
    const getEnquiryCounts = vi.fn().mockResolvedValue({ todoCount: 3, doneCount: 5, allCount: 8 });
    const listBookingRecoveryCases = vi.fn().mockResolvedValue([{ id: "booking-case-1" }]);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      paginationFromRequestUrl: vi.fn().mockReturnValue(pagination),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getEnquiryCounts,
      listCustomers: vi.fn().mockResolvedValue([]),
      listJobTypes: vi.fn().mockResolvedValue([]),
      listLeads,
      listServices: vi.fn().mockResolvedValue([]),
      listUserProfiles: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/platform/lib/booking-recovery", () => ({
      listBookingRecoveryCases,
    }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn((value) => value),
    }));
    vi.doMock("@/modules/crm/lib/rules", () => ({
      validateRequiredProgression: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/custom-fields", () => ({
      extractCustomFieldValues: vi.fn(),
      upsertCustomFieldValues: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/route");
    const response = (await route.GET!(new Request("http://localhost/api/crm/leads?tab=done"))) as Response;
    const body = await response.json();

    expect(listLeads).toHaveBeenCalledWith("live", pagination, "done");
    expect(body.recoveryCases).toEqual([]);
    expect(body.visibleCount).toBe(1);
  });

  it("overrides the dashboard enquiry count with the same To-do definition", async () => {
    const dashboardData = { newLeadCount: 99, aiReceptionistReviewCount: 0 };
    const getDashboardData = vi.fn().mockResolvedValue(dashboardData);
    const getEnquiryCounts = vi.fn().mockResolvedValue({ todoCount: 3, doneCount: 5, allCount: 8 });
    const listBookingRecoveryCases = vi.fn().mockResolvedValue([{ id: "booking-case-1" }]);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase: {}, tenant: { id: "tenant-1" } },
      }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      getDashboardData,
      getEnquiryCounts,
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/platform/lib/booking-recovery", () => ({
      listBookingRecoveryCases,
    }));

    const route = await import("@/app/api/crm/dashboard/summary/route");
    const response = (await route.GET!()) as Response;
    const body = await response.json();

    expect(body.data.newLeadCount).toBe(4);
    expect(body.data.aiReceptionistReviewCount).toBe(1);
  });
});
