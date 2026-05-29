import Link from "next/link";
import {
  DEFAULT_CRM_PAGE_SIZE,
  normalizeCrmPagination,
  type CrmPaginationInput,
} from "@/modules/crm/lib/performance";

type SearchParams = Record<string, string | string[] | undefined>;

type PaginationControlsProps = {
  basePath: string;
  itemCount: number;
  pagination: CrmPaginationInput;
  searchParams?: SearchParams;
};

function buildHref(basePath: string, searchParams: SearchParams | undefined, page: number, pageSize: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === "page" || key === "pageSize" || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    params.set(key, value);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pageSize !== DEFAULT_CRM_PAGE_SIZE) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function PaginationControls({ basePath, itemCount, pagination, searchParams }: PaginationControlsProps) {
  const current = normalizeCrmPagination(pagination);
  const hasPrevious = current.page > 1;
  const hasNext = itemCount >= current.pageSize;

  if (!hasPrevious && !hasNext) {
    return null;
  }

  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <Link
        href={buildHref(basePath, searchParams, current.page - 1, current.pageSize)}
        aria-disabled={!hasPrevious}
        className={`rounded-md border px-3 py-2 font-medium ${
          hasPrevious
            ? "border-slate-200 text-slate-700 hover:bg-slate-50"
            : "pointer-events-none border-slate-100 text-slate-300"
        }`}
      >
        Previous
      </Link>
      <span className="text-xs font-medium text-slate-500">Page {current.page}</span>
      <Link
        href={buildHref(basePath, searchParams, current.page + 1, current.pageSize)}
        aria-disabled={!hasNext}
        className={`rounded-md border px-3 py-2 font-medium ${
          hasNext
            ? "border-slate-200 text-slate-700 hover:bg-slate-50"
            : "pointer-events-none border-slate-100 text-slate-300"
        }`}
      >
        Next
      </Link>
    </nav>
  );
}
