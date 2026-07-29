import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression cover for two quote-screen bugs reported 2026-07-30:
//   1. The Draft/Sent/Accepted/Declined tabs never filtered — the status was
//      never sent to the API and listQuotes never applied it to the query.
//   2. The quote form's job dropdown listed every job for every customer
//      because the two selects were not linked.

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

/** Minimal Supabase query-builder double that records the .eq() calls made. */
function createQueryDouble() {
  const eqCalls: Array<[string, unknown]> = [];
  const query: Record<string, unknown> = {};
  const chain = () => query;
  Object.assign(query, {
    select: vi.fn(chain),
    order: vi.fn(chain),
    range: vi.fn(chain),
    limit: vi.fn(chain),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return query;
    }),
  });
  return { query, eqCalls };
}

async function loadListQuotes(queryDouble: ReturnType<typeof createQueryDouble>) {
  vi.doMock("@/modules/crm/lib/env", () => ({
    getCrmEnv: () => ({ enabled: true }),
  }));
  vi.doMock("@/modules/crm/lib/supabase-server", () => ({
    createCrmServerClient: vi.fn().mockResolvedValue({
      schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(queryDouble.query) }),
    }),
    createCrmServiceRoleClient: vi.fn(),
  }));
  vi.doMock("@/modules/crm/lib/data-runner", () => ({
    runCrmList: vi.fn().mockResolvedValue([]),
    runCrmListStrict: vi.fn().mockResolvedValue([]),
    runCrmSingle: vi.fn().mockResolvedValue(null),
  }));
  const { listQuotes } = await import("@/modules/crm/lib/data");
  return listQuotes;
}

describe("quote list status filtering", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("applies a status filter to the quotes query when one is supplied", async () => {
    const queryDouble = createQueryDouble();
    const listQuotes = await loadListQuotes(queryDouble);

    await listQuotes("live", undefined, { status: "sent" });

    expect(queryDouble.eqCalls).toContainEqual(["status", "sent"]);
    // Live mode must still exclude demo rows.
    expect(queryDouble.eqCalls).toContainEqual(["is_demo", false]);
  });

  it("does not filter by status when none is supplied (the All tab)", async () => {
    const queryDouble = createQueryDouble();
    const listQuotes = await loadListQuotes(queryDouble);

    await listQuotes("live", undefined, { status: null });
    await listQuotes("live");

    expect(queryDouble.eqCalls.filter(([column]) => column === "status")).toHaveLength(0);
  });
});

describe("quotes API status parameter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  async function loadRoute(listQuotes: ReturnType<typeof vi.fn>) {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { tenant: { id: "tenant-1" } } }),
      paginationFromRequestUrl: vi.fn().mockReturnValue({}),
      computeFinancials: vi.fn(),
      nextQuoteNumber: vi.fn(),
      parseLineItems: vi.fn(),
      resolveCreatedByUserId: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({ listQuotes }));
    vi.doMock("@/modules/crm/lib/performance", () => ({
      normalizeCrmPagination: vi.fn().mockReturnValue({ page: 1, pageSize: 20 }),
    }));
    return import("@/app/api/crm/quotes/route");
  }

  it("passes a valid status through to the query", async () => {
    const listQuotes = vi.fn().mockResolvedValue([]);
    const route = await loadRoute(listQuotes);

    await route.GET(new Request("http://localhost/api/crm/quotes?status=sent"));

    expect(listQuotes).toHaveBeenCalledWith("live", expect.anything(), { status: "sent" });
  });

  it("treats the All tab and unknown values as no filter", async () => {
    const listQuotes = vi.fn().mockResolvedValue([]);
    const route = await loadRoute(listQuotes);

    await route.GET(new Request("http://localhost/api/crm/quotes?status=all"));
    await route.GET(new Request("http://localhost/api/crm/quotes?status=bogus"));
    await route.GET(new Request("http://localhost/api/crm/quotes"));

    for (const call of listQuotes.mock.calls) {
      expect(call[2]).toEqual({ status: null });
    }
  });

  it("recognises every real quote status", async () => {
    const route = await loadRoute(vi.fn().mockResolvedValue([]));

    expect(route.parseQuoteStatusFilter("draft")).toBe("draft");
    expect(route.parseQuoteStatusFilter("sent")).toBe("sent");
    expect(route.parseQuoteStatusFilter("accepted")).toBe("accepted");
    expect(route.parseQuoteStatusFilter("declined")).toBe("declined");
    expect(route.parseQuoteStatusFilter("all")).toBeNull();
    expect(route.parseQuoteStatusFilter(null)).toBeNull();
  });
});

describe("quote form job dropdown scoping", () => {
  const jobs = [
    { id: "job-1", customer_id: "cust-1", title: "Combi Boiler Swap" },
    { id: "job-2", customer_id: "cust-2", title: "Bathroom Refit" },
    { id: "job-3", customer_id: "cust-1", title: "Radiator Repair" },
  ] as never[];

  it("offers only the selected customer's jobs", async () => {
    const { filterJobsForCustomer } = await import("@/modules/crm/components/forms/QuoteCreateForm");

    expect(filterJobsForCustomer(jobs, "cust-1").map((job) => job.id)).toEqual(["job-1", "job-3"]);
    expect(filterJobsForCustomer(jobs, "cust-2").map((job) => job.id)).toEqual(["job-2"]);
  });

  it("offers nothing until a customer is chosen", async () => {
    const { filterJobsForCustomer } = await import("@/modules/crm/components/forms/QuoteCreateForm");

    expect(filterJobsForCustomer(jobs, "")).toEqual([]);
  });

  it("returns an empty list for a customer with no jobs", async () => {
    const { filterJobsForCustomer } = await import("@/modules/crm/components/forms/QuoteCreateForm");

    expect(filterJobsForCustomer(jobs, "cust-nope")).toEqual([]);
  });
});
