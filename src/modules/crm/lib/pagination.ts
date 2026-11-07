// Pure pagination helpers shared by browser and server components.
export const DEFAULT_CRM_PAGE_SIZE = 50;
export const MAX_CRM_PAGE_SIZE = 100;

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
