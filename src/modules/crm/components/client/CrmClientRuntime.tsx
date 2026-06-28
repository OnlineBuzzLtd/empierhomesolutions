"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

type CacheEntry = {
  expiresAt: number;
  promise?: Promise<unknown>;
  data?: unknown;
};

type CrmClientRuntimeContextValue = {
  tenantId: string | null;
  navigationPending: boolean;
  beginNavigation: (href: string) => void;
};

const DEFAULT_TTL_MS = 30_000;
const CRM_CACHE_INVALIDATED_EVENT = "crm-client-cache-invalidated";
const cache = new Map<string, CacheEntry>();
const CrmClientRuntimeContext = createContext<CrmClientRuntimeContextValue>({
  tenantId: null,
  navigationPending: false,
  beginNavigation: () => undefined,
});

function cacheKey(tenantId: string | null, url: string) {
  return `${tenantId ?? "no-tenant"}:${url}`;
}

function entryUrlFromCacheKey(key: string) {
  const separatorIndex = key.indexOf(":");
  return separatorIndex === -1 ? key : key.slice(separatorIndex + 1);
}

function pathMatches(url: string, paths: readonly string[]) {
  if (paths.length === 0) {
    return true;
  }

  let pathname = url;
  try {
    pathname = new URL(url, window.location.origin).pathname;
  } catch {
    pathname = url.split("?")[0] ?? url;
  }

  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function clearCrmClientCache() {
  cache.clear();
}

export function invalidateCrmClientCache(paths: string[] = []) {
  for (const key of cache.keys()) {
    if (pathMatches(entryUrlFromCacheKey(key), paths)) {
      cache.delete(key);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRM_CACHE_INVALIDATED_EVENT, { detail: { paths } }));
  }
}

export function CrmClientRuntimeProvider({
  children,
  tenantId,
}: {
  children: ReactNode;
  tenantId: string | null;
}) {
  const pathname = usePathname();
  const lastTenantId = useRef(tenantId);
  const [navigationPending, setNavigationPending] = useState(false);

  useEffect(() => {
    if (lastTenantId.current !== tenantId) {
      clearCrmClientCache();
      lastTenantId.current = tenantId;
    }
  }, [tenantId]);

  useEffect(() => {
    const id = window.setTimeout(() => setNavigationPending(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  const beginNavigation = useCallback(
    (href: string) => {
      if (!href || href.startsWith("#") || href === pathname) {
        return;
      }
      setNavigationPending(true);
    },
    [pathname],
  );

  const value = useMemo(
    () => ({ tenantId, navigationPending, beginNavigation }),
    [tenantId, navigationPending, beginNavigation],
  );

  return (
    <CrmClientRuntimeContext.Provider value={value}>
      {navigationPending ? (
        <div
          data-crm-navigation-pending="true"
          className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-cyan-100"
        >
          <div className="h-full w-1/2 animate-pulse bg-cyan-500" />
        </div>
      ) : null}
      {children}
    </CrmClientRuntimeContext.Provider>
  );
}

export function useCrmClientRuntime() {
  return useContext(CrmClientRuntimeContext);
}

export function CrmInstantLink({
  href,
  onClick,
  prefetch = true,
  ...props
}: LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    href: string;
  }) {
  const { beginNavigation } = useCrmClientRuntime();

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        beginNavigation(href);
      }}
      {...props}
    />
  );
}

export function useCrmApi<T>(url: string | null, options: { ttlMs?: number } = {}) {
  const { tenantId } = useCrmClientRuntime();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: Boolean(url) });

  const load = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!url) {
        setState({ data: null, error: null, loading: false });
        return;
      }

      const key = cacheKey(tenantId, url);
      const existing = cache.get(key);
      const now = Date.now();
      if (!force && existing?.data !== undefined && existing.expiresAt > now) {
        setState({ data: existing.data as T, error: null, loading: false });
        return;
      }

      const promise =
        !force && existing?.promise
          ? existing.promise
          : fetch(url, {
              credentials: "same-origin",
              headers: { Accept: "application/json" },
            }).then(async (response) => {
              const payload = await response.json().catch(() => null);
              if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error ?? "CRM request failed.");
              }
              return payload;
            });

      cache.set(key, { promise, expiresAt: now + ttlMs });
      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const data = (await promise) as T;
        cache.set(key, { data, expiresAt: Date.now() + ttlMs });
        setState({ data, error: null, loading: false });
      } catch (error) {
        cache.delete(key);
        setState({
          data: null,
          error: error instanceof Error ? error.message : "CRM request failed.",
          loading: false,
        });
      }

    },
    [tenantId, ttlMs, url],
  );

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (!cancelled) {
        void load();
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [load]);

  useEffect(() => {
    if (!url) {
      return;
    }
    const activeUrl = url;

    function handleInvalidated(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const paths = Array.isArray(detail?.paths) ? detail.paths.filter((path: unknown) => typeof path === "string") : [];
      if (pathMatches(activeUrl, paths)) {
        void load({ force: true });
      }
    }

    window.addEventListener(CRM_CACHE_INVALIDATED_EVENT, handleInvalidated);
    return () => window.removeEventListener(CRM_CACHE_INVALIDATED_EVENT, handleInvalidated);
  }, [load, url]);

  return {
    ...state,
    refresh: () => load({ force: true }),
  };
}
