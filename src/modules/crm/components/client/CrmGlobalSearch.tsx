"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CrmInstantLink } from "@/modules/crm/components/client/CrmClientRuntime";
import type { CrmSearchResult, CrmSearchResultType } from "@/modules/crm/lib/search";

type SearchResponse = {
  ok: true;
  query: string;
  items: CrmSearchResult[];
};

const typeLabels: Record<CrmSearchResultType, string> = {
  customer: "Customers",
  enquiry: "Enquiries",
  job: "Jobs",
  quote: "Quotes",
  invoice: "Invoices",
};

function groupResults(items: CrmSearchResult[]) {
  const grouped = new Map<CrmSearchResultType, CrmSearchResult[]>();
  for (const item of items) {
    grouped.set(item.type, [...(grouped.get(item.type) ?? []), item]);
  }
  return Array.from(grouped.entries());
}

export function CrmGlobalSearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CrmSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trimmedQuery = query.trim();
  const grouped = useMemo(() => groupResults(items), [items]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/crm/search?q=${encodeURIComponent(trimmedQuery)}`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as SearchResponse | { error?: string } | null;
        if (!response.ok || !body || !("ok" in body)) {
          setError(body && "error" in body && body.error ? body.error : "Search failed.");
          setItems([]);
          return;
        }
        setItems(body.items);
        setOpen(true);
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : "Search failed.");
          setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [trimmedQuery]);

  const showPanel = open && trimmedQuery.length >= 2;

  return (
    <div ref={rootRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
          placeholder="Search CRM"
          aria-label="Search CRM"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setItems([]);
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
          {loading ? <p className="px-3 py-2 text-sm text-slate-500">Searching...</p> : null}
          {error ? <p className="px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {!loading && !error && items.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">No matches</p> : null}
          {!error
            ? grouped.map(([type, results]) => (
                <div key={type} className="py-1">
                  <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{typeLabels[type]}</p>
                  <div className="space-y-1">
                    {results.map((item) => (
                      <div key={item.id} className="rounded-md px-3 py-2 hover:bg-slate-50">
                        <CrmInstantLink href={item.href} onClick={() => setOpen(false)} className="block">
                          <span className="block truncate text-sm font-semibold text-slate-900">{item.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{item.meta || item.action}</span>
                        </CrmInstantLink>
                        {item.callHref || item.callNoteHref ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.callHref ? (
                              <a
                                href={item.callHref}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                              >
                                Call
                              </a>
                            ) : null}
                            {item.callNoteHref ? (
                              <CrmInstantLink
                                href={item.callNoteHref}
                                onClick={() => setOpen(false)}
                                className="rounded-md border border-cyan-200 px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
                              >
                                Log call
                              </CrmInstantLink>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
