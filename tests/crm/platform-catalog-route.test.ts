import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCatalogResponse } from "@/modules/crm/lib/ai-catalog";

function computeSignature(secret: string, timestamp: string, rawBody: string) {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

function signedGet(url: string, secret = "test-secret") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return new Request(url, {
    headers: {
      "x-platform-timestamp": timestamp,
      "x-platform-signature": computeSignature(secret, timestamp, ""),
    },
  });
}

function mockTenantLookup(tenantId: string | null) {
  return {
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              tenantId === null ? { data: null, error: null } : { data: { id: tenantId }, error: null },
            ),
          }),
        }),
      }),
    }),
  };
}

const catalog: AiCatalogResponse = {
  tenant: {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "empire",
    name: "Empire",
    trade_vertical: "plumbing",
    timezone: "Europe/London",
    currency: "GBP",
    vat_mode: "exclusive",
  },
  version: "catalog-v1",
  generated_at: "2026-05-30T12:00:00.000Z",
  channels: {
    whatsapp: { uses_catalog: true },
    sms: { uses_catalog: true },
    web_chat: { uses_catalog: true },
    voice: { uses_catalog: true },
  },
  services: [],
  packages: [],
  booking_rules: {
    default_duration_minutes: 60,
    emergency_duration_minutes: 120,
    can_quote_prices_in_chat: true,
    requires_office_quote_for_installations: true,
  },
  pricing_policy: {
    can_give_fixed_prices: false,
    can_give_from_prices: true,
    fallback_phrase: "The office confirms final pricing before work starts.",
  },
  safety_policy: {
    emergency_escalation_text: "Call emergency services if there is immediate danger.",
    gas_safety_text: null,
    electrical_safety_text: null,
  },
};

describe("platform catalogue route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: "test-secret" }),
    }));
  });

  it("rejects unsigned requests", async () => {
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/ai-catalog", () => ({
      buildAiCatalogForTenant: vi.fn(),
    }));

    const route = await import("@/app/api/platform/catalog/route");
    const response = await route.GET(new Request("http://localhost/api/platform/catalog?crmTenantId=tenant-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Missing x-platform-signature.");
  });

  it("returns the tenant catalogue for a valid signed request", async () => {
    const supabase = mockTenantLookup(catalog.tenant.id);
    const buildAiCatalogForTenant = vi.fn().mockResolvedValue(catalog);

    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue(supabase),
    }));
    vi.doMock("@/modules/crm/lib/ai-catalog", () => ({
      buildAiCatalogForTenant,
    }));

    const route = await import("@/app/api/platform/catalog/route");
    const response = await route.GET(
      signedGet(`http://localhost/api/platform/catalog?crmTenantId=${catalog.tenant.id}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(buildAiCatalogForTenant).toHaveBeenCalledWith(supabase, catalog.tenant.id);
    expect(body.version).toBe("catalog-v1");
    expect(JSON.stringify(body)).not.toContain("unit_cost");
  });

  it("returns 404 for an unknown tenant", async () => {
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue(mockTenantLookup(null)),
    }));
    vi.doMock("@/modules/crm/lib/ai-catalog", () => ({
      buildAiCatalogForTenant: vi.fn(),
    }));

    const route = await import("@/app/api/platform/catalog/route");
    const response = await route.GET(signedGet("http://localhost/api/platform/catalog?crmTenantId=missing"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Tenant not found.");
  });
});
