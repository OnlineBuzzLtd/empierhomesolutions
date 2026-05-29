import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

export const DEFAULT_CRM_PAGE_SIZE = 50;
export const MAX_CRM_PAGE_SIZE = 100;
export const CRM_SLOW_QUERY_MS = 750;

export type CrmPaginationInput = {
  page?: number | string | null;
  pageSize?: number | string | null;
};

export type CrmPagination = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

type RangeQueryable<T> = {
  range: (from: number, to: number) => T;
};

type TimedResponse<T> = {
  data: T[] | T | null;
  error?: unknown;
};

export type CrmQueryTiming = {
  key: string;
  durationMs: number;
  rowCount: number | null;
  ok: boolean;
};

function toPositiveInteger(value: number | string | null | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function normalizeCrmPagination(input: CrmPaginationInput = {}): CrmPagination {
  const page = toPositiveInteger(input.page, 1);
  const requestedPageSize = toPositiveInteger(input.pageSize, DEFAULT_CRM_PAGE_SIZE);
  const pageSize = Math.min(Math.max(requestedPageSize, 1), MAX_CRM_PAGE_SIZE);
  const from = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
  };
}

export function crmPaginationFromSearchParams(
  params: Record<string, string | string[] | undefined> | null | undefined,
): CrmPaginationInput {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return {
    page: first(params?.page),
    pageSize: first(params?.pageSize),
  };
}

export function applyCrmPagination<T>(query: RangeQueryable<T>, input: CrmPaginationInput = {}) {
  const pagination = normalizeCrmPagination(input);
  return query.range(pagination.from, pagination.to);
}

export function hashCrmTenantIdForLogs(tenantId: string | null | undefined) {
  if (!tenantId) return null;
  return createHash("sha256").update(tenantId).digest("hex").slice(0, 12);
}

function rowCountFor(data: unknown) {
  if (Array.isArray(data)) return data.length;
  return data ? 1 : 0;
}

export function buildCrmQueryTiming(input: {
  key: string;
  startedAt: number;
  data: unknown;
  error?: unknown;
}): CrmQueryTiming {
  return {
    key: input.key,
    durationMs: Math.round((performance.now() - input.startedAt) * 10) / 10,
    rowCount: rowCountFor(input.data),
    ok: !input.error,
  };
}

export function reportCrmQueryTiming(timing: CrmQueryTiming) {
  Sentry.addBreadcrumb({
    category: "crm.performance",
    level: timing.ok ? "info" : "warning",
    message: timing.key,
    data: {
      durationMs: timing.durationMs,
      rowCount: timing.rowCount,
      ok: timing.ok,
    },
  });

  if (process.env.NODE_ENV !== "production" && timing.durationMs >= CRM_SLOW_QUERY_MS) {
    console.warn(
      `[crm.performance] slow query ${timing.key} ${timing.durationMs}ms rows=${timing.rowCount ?? "unknown"}`,
    );
  }
}

export async function measureCrmQuery<T extends TimedResponse<unknown>>(
  key: string,
  query: PromiseLike<T>,
): Promise<T> {
  const startedAt = performance.now();
  const response = await query;
  reportCrmQueryTiming(
    buildCrmQueryTiming({
      key,
      startedAt,
      data: response.data,
      error: response.error,
    }),
  );
  return response;
}
