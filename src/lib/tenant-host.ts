// Tenant resolution by HTTP host header.
//
// Supports three deployment topologies:
//
//   1. Per-tenant subdomain on the CRM wildcard:
//        `empire.crm.customerjourneys.ai`     -> slug="empire"
//        `acme-ltd.crm.customerjourneys.ai`   -> slug="acme-ltd"
//
//   2. Apex CRM host, used for marketing + signup:
//        `crm.customerjourneys.ai`            -> slug=null
//        `www.crm.customerjourneys.ai`        -> slug=null
//
//   3. Preview / local environments:
//        `*.vercel.app`                       -> slug=null (fallback to
//                                                user's tenant membership)
//        `localhost:3000`, `*.local`          -> slug=null
//
// We deliberately don't try to look up the tenant in the database from
// the middleware — Next.js middleware runs on the edge and shouldn't
// hit Supabase for every request. Instead we stamp `x-tenant-slug` on
// the request and let server-side handlers resolve the tenant via
// `crm.tenants` when they need it.

export type TenantHostBinding = {
  slug: string | null;
  host: string;
  rootDomain: string | null;
  isApex: boolean;
};

const DEFAULT_ROOT_DOMAINS = [
  // Canonical production root for multi-tenant CRM (Phase 3 of the plan).
  "crm.customerjourneys.ai",
];

function resolveRootDomains(): string[] {
  const envRoots = process.env.CRM_TENANT_ROOT_DOMAINS;
  if (!envRoots) {
    return DEFAULT_ROOT_DOMAINS;
  }

  return envRoots
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is string => value.length > 0);
}

function isReservedSubdomain(slug: string): boolean {
  // Reserved subdomains that should never be treated as a tenant slug,
  // either because they belong to the marketing site (www), to Vercel's
  // protection check pages, or because they'd collide with tenant names
  // we want to keep for ourselves.
  return (
    slug === "www" ||
    slug === "api" ||
    slug === "admin" ||
    slug === "app" ||
    slug === "console" ||
    slug === "status" ||
    slug === "docs"
  );
}

export function resolveTenantFromHost(hostHeader: string | null): TenantHostBinding {
  const host = (hostHeader ?? "").toLowerCase().replace(/:\d+$/, "");

  if (!host) {
    return { slug: null, host: "", rootDomain: null, isApex: false };
  }

  for (const rootDomain of resolveRootDomains()) {
    if (host === rootDomain) {
      return { slug: null, host, rootDomain, isApex: true };
    }

    if (host.endsWith(`.${rootDomain}`)) {
      const prefix = host.slice(0, -1 - rootDomain.length);
      if (prefix.length === 0 || prefix.includes(".")) {
        // Multi-level subdomain like `foo.bar.crm.customerjourneys.ai`.
        // Use only the leftmost label as the tenant slug, but only if it's
        // directly under the root.
        const segments = prefix.split(".");
        if (segments.length > 1) {
          // Nested subdomain — not supported by the wildcard cert, so
          // treat as non-tenant.
          return { slug: null, host, rootDomain, isApex: false };
        }
      }

      if (isReservedSubdomain(prefix)) {
        return { slug: null, host, rootDomain, isApex: true };
      }

      return { slug: prefix, host, rootDomain, isApex: false };
    }
  }

  return { slug: null, host, rootDomain: null, isApex: false };
}

export function tenantSlugFromHostHeader(hostHeader: string | null): string | null {
  return resolveTenantFromHost(hostHeader).slug;
}
