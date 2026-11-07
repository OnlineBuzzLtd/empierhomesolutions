import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

export { DEFAULT_CRM_PAGE_SIZE, MAX_CRM_PAGE_SIZE, normalizeCrmPagination, crmPaginationFromSearchParams } from "./pagination";
export type { CrmPaginationInput, CrmPagination } from "./pagination";
import { normalizeCrmPagination, type CrmPaginationInput } from "./pagination";
export const CRM_SLOW_QUERY_MS = 750;

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
