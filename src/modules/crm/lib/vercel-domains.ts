import { getCrmEnv } from "@/modules/crm/lib/env";

// Attach `{slug}.crm.customerjourneys.ai` to the Vercel project so the
// Phase 3.1 wildcard certificate starts serving traffic for the new
// tenant. This is best-effort: if the Vercel API credentials are
// missing we return a structured warning instead of throwing, so a
// temporary credential rotation never blocks a tenant signup.

type VercelDomainResult = {
  ok: boolean;
  domain: string;
  warning: string | null;
};

function buildTenantHost(slug: string, rootDomain: string): string {
  return `${slug}.${rootDomain}`;
}

export async function ensureTenantVercelDomain(input: {
  tenantSlug: string;
}): Promise<VercelDomainResult> {
  const env = getCrmEnv();
  const rootDomain = env.crmTenantRootDomain;
  const vercelToken = env.vercelApiToken;
  const vercelProjectId = env.vercelProjectId;

  if (!rootDomain) {
    return {
      ok: false,
      domain: input.tenantSlug,
      warning: "CRM_TENANT_ROOT_DOMAIN not set — skipping Vercel domain attach.",
    };
  }

  const domain = buildTenantHost(input.tenantSlug, rootDomain);

  if (!vercelToken || !vercelProjectId) {
    return {
      ok: false,
      domain,
      warning: "VERCEL_API_TOKEN / VERCEL_PROJECT_ID not set — skipping Vercel domain attach.",
    };
  }

  // https://vercel.com/docs/rest-api/endpoints/projects#add-a-domain-to-a-project
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(vercelProjectId)}/domains${
    env.vercelTeamId ? `?teamId=${encodeURIComponent(env.vercelTeamId)}` : ""
  }`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${vercelToken}`,
      },
      body: JSON.stringify({ name: domain }),
    });

    if (response.status === 409) {
      // Already attached — treat as success (idempotent).
      return { ok: true, domain, warning: null };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        domain,
        warning: `Vercel domain attach failed (${response.status}): ${body.slice(0, 200)}`,
      };
    }

    return { ok: true, domain, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vercel domain attach failed.";
    return { ok: false, domain, warning: message };
  }
}
