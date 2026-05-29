import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CRM_PAGE_SIZE,
  MAX_CRM_PAGE_SIZE,
  applyCrmPagination,
  buildCrmQueryTiming,
  crmPaginationFromSearchParams,
  hashCrmTenantIdForLogs,
  normalizeCrmPagination,
} from "@/modules/crm/lib/performance";

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
}));

describe("crm performance helpers", () => {
  it("normalizes pagination with safe defaults and a hard upper bound", () => {
    expect(normalizeCrmPagination()).toEqual({
      page: 1,
      pageSize: DEFAULT_CRM_PAGE_SIZE,
      from: 0,
      to: DEFAULT_CRM_PAGE_SIZE - 1,
    });

    expect(normalizeCrmPagination({ page: "3", pageSize: "500" })).toEqual({
      page: 3,
      pageSize: MAX_CRM_PAGE_SIZE,
      from: 200,
      to: 299,
    });

    expect(normalizeCrmPagination({ page: "-1", pageSize: "nope" })).toEqual({
      page: 1,
      pageSize: DEFAULT_CRM_PAGE_SIZE,
      from: 0,
      to: DEFAULT_CRM_PAGE_SIZE - 1,
    });
  });

  it("extracts pagination from route search params", () => {
    expect(crmPaginationFromSearchParams({ page: ["2", "ignored"], pageSize: "25" })).toEqual({
      page: "2",
      pageSize: "25",
    });
  });

  it("applies Supabase inclusive ranges from normalized pagination", () => {
    const query = {
      range: vi.fn().mockReturnValue("ranged-query"),
    };

    expect(applyCrmPagination(query, { page: 2, pageSize: 10 })).toBe("ranged-query");
    expect(query.range).toHaveBeenCalledWith(10, 19);
  });

  it("hashes tenant identifiers before logging", () => {
    const hashed = hashCrmTenantIdForLogs("11111111-1111-4111-8111-111111111111");

    expect(hashed).toHaveLength(12);
    expect(hashed).not.toContain("111111");
    expect(hashCrmTenantIdForLogs(null)).toBeNull();
  });

  it("builds redacted query timing metadata", () => {
    const timing = buildCrmQueryTiming({
      key: "listJobs",
      startedAt: performance.now(),
      data: [{ id: "job-1" }, { id: "job-2" }],
    });

    expect(timing.key).toBe("listJobs");
    expect(timing.rowCount).toBe(2);
    expect(timing.ok).toBe(true);
    expect(timing.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("crm performance proof helpers", () => {
  it("computes p95 route budgets and marks slow routes as failed", async () => {
    const modulePath = "../../scripts/perf/crm-performance-proof-lib.mjs";
    const { evaluateRouteBudgets } = await import(modulePath);

    const [fast, slow] = evaluateRouteBudgets([
      {
        path: "/jobs",
        group: "hotList",
        thresholdMs: 1500,
        samples: [
          { status: 200, durationMs: 900 },
          { status: 200, durationMs: 1100 },
          { status: 200, durationMs: 1200 },
        ],
      },
      {
        path: "/reports",
        group: "reports",
        thresholdMs: 2500,
        samples: [
          { status: 200, durationMs: 2400 },
          { status: 200, durationMs: 2600 },
          { status: 200, durationMs: 3000 },
        ],
      },
    ]);

    expect(fast.passed).toBe(true);
    expect(fast.summary.p95Ms).toBe(1200);
    expect(slow.passed).toBe(false);
    expect(slow.failure).toContain("exceeded");
  });

  it("marks route navigation failures as failed even when they are fast", async () => {
    const modulePath = "../../scripts/perf/crm-performance-proof-lib.mjs";
    const { evaluateRouteBudgets } = await import(modulePath);

    const [result] = evaluateRouteBudgets([
      {
        path: "/reports",
        group: "reports",
        thresholdMs: 2500,
        samples: [{ status: 0, durationMs: 120, error: "navigation aborted" }],
      },
    ]);

    expect(result.passed).toBe(false);
    expect(result.failure).toContain("navigation failure");
  });

  it("fails explain budgets when a hot query uses a sequential scan", async () => {
    const modulePath = "../../scripts/perf/crm-performance-proof-lib.mjs";
    const { evaluateExplainBudgets } = await import(modulePath);

    const [result] = evaluateExplainBudgets([
      {
        name: "jobs-list",
        thresholdMs: 250,
        executionTimeMs: 25,
        disallowSeqScan: ["jobs"],
        plan: {
          "Node Type": "Limit",
          Plans: [{ "Node Type": "Seq Scan", "Relation Name": "jobs" }],
        },
      },
    ]);

    expect(result.passed).toBe(false);
    expect(result.failure).toContain("sequential scan");
  });
});
