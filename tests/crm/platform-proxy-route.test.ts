import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "11111111-1111-4111-8111-111111111111";
const platformTenantId = "b469a9fe-546d-4baa-9f87-3487c7c4afc1";

describe("platform proxy route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function mockSession() {
    return {
      configured: true,
      tenant: { id: tenantId },
    };
  }

  it("returns the runtime-link setup error when the tenant is not linked", async () => {
    vi.doMock("@/modules/crm/lib/auth", () => ({
      requireCrmUser: vi.fn().mockResolvedValue(mockSession()),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue(null),
    }));

    const route = await import("@/app/api/platform/proxy/[...path]/route");
    const response = await route.GET(
      new Request(
        `http://localhost/api/platform/proxy/v1/internal/tenants/${platformTenantId}/calendar/availability-snapshot`,
      ),
      {
        params: Promise.resolve({
          path: ["v1", "internal", "tenants", platformTenantId, "calendar", "availability-snapshot"],
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Platform runtime link is not configured");
  });

  it("returns the internal-token setup error for a linked tenant with missing env", async () => {
    vi.doMock("@/modules/crm/lib/auth", () => ({
      requireCrmUser: vi.fn().mockResolvedValue(mockSession()),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        crm_tenant_id: tenantId,
        customerjourneys_tenant_id: platformTenantId,
        platform_api_base_url: "https://runtime.example.com",
      }),
    }));
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        customerJourneysPlatformApiBaseUrl: "https://runtime.example.com",
        customerJourneysPlatformApiBaseUrlOverride: null,
        customerJourneysInternalApiToken: null,
      }),
    }));

    const route = await import("@/app/api/platform/proxy/[...path]/route");
    const response = await route.GET(
      new Request(
        `http://localhost/api/platform/proxy/v1/internal/tenants/${platformTenantId}/calendar/schedule-snapshot`,
      ),
      {
        params: Promise.resolve({
          path: ["v1", "internal", "tenants", platformTenantId, "calendar", "schedule-snapshot"],
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("CUSTOMERJOURNEYS_INTERNAL_API_TOKEN");
  });

  it("returns the base-url setup error when the link and env do not provide one", async () => {
    vi.doMock("@/modules/crm/lib/auth", () => ({
      requireCrmUser: vi.fn().mockResolvedValue(mockSession()),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        crm_tenant_id: tenantId,
        customerjourneys_tenant_id: platformTenantId,
        platform_api_base_url: null,
      }),
    }));
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        customerJourneysPlatformApiBaseUrl: null,
        customerJourneysPlatformApiBaseUrlOverride: null,
        customerJourneysInternalApiToken: "internal-token",
      }),
    }));

    const route = await import("@/app/api/platform/proxy/[...path]/route");
    const response = await route.GET(
      new Request(
        `http://localhost/api/platform/proxy/v1/internal/tenants/${platformTenantId}/calendar/schedule-snapshot`,
      ),
      {
        params: Promise.resolve({
          path: ["v1", "internal", "tenants", platformTenantId, "calendar", "schedule-snapshot"],
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Platform API base URL is not configured for this tenant.");
  });

  it("returns 403 when the caller asks for another tenant's platform id", async () => {
    vi.doMock("@/modules/crm/lib/auth", () => ({
      requireCrmUser: vi.fn().mockResolvedValue(mockSession()),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        crm_tenant_id: tenantId,
        customerjourneys_tenant_id: platformTenantId,
        platform_api_base_url: "https://runtime.example.com",
      }),
    }));
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        customerJourneysPlatformApiBaseUrl: "https://runtime.example.com",
        customerJourneysPlatformApiBaseUrlOverride: null,
        customerJourneysInternalApiToken: "internal-token",
      }),
    }));

    const route = await import("@/app/api/platform/proxy/[...path]/route");
    const response = await route.GET(
      new Request("http://localhost/api/platform/proxy/v1/internal/tenants/not-your-tenant/calendar/schedule-snapshot"),
      {
        params: Promise.resolve({
          path: ["v1", "internal", "tenants", "not-your-tenant", "calendar", "schedule-snapshot"],
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Tenant mismatch.");
  });

  it("proxies the request with the internal service token when runtime access is ready", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: "2026-04-23", resources: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("@/modules/crm/lib/auth", () => ({
      requireCrmUser: vi.fn().mockResolvedValue(mockSession()),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        crm_tenant_id: tenantId,
        customerjourneys_tenant_id: platformTenantId,
        platform_api_base_url: "https://runtime.example.com/",
      }),
    }));
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        customerJourneysPlatformApiBaseUrl: "https://runtime.example.com",
        customerJourneysPlatformApiBaseUrlOverride: null,
        customerJourneysInternalApiToken: "internal-token",
      }),
    }));

    const route = await import("@/app/api/platform/proxy/[...path]/route");
    const response = await route.GET(
      new Request(
        `http://localhost/api/platform/proxy/v1/internal/tenants/${platformTenantId}/calendar/schedule-snapshot?from=2026-04-23T00:00:00.000Z&to=2026-04-24T00:00:00.000Z`,
      ),
      {
        params: Promise.resolve({
          path: ["v1", "internal", "tenants", platformTenantId, "calendar", "schedule-snapshot"],
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBe("2026-04-23");
    expect(fetchMock).toHaveBeenCalledWith(
      `https://runtime.example.com/v1/internal/tenants/${platformTenantId}/calendar/schedule-snapshot?from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z`,
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-internal-service-token")).toBe("internal-token");

    vi.unstubAllGlobals();
  });

  it("preserves upstream 204 responses without constructing an invalid body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("@/modules/crm/lib/auth", () => ({
      requireCrmUser: vi.fn().mockResolvedValue(mockSession()),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        crm_tenant_id: tenantId,
        customerjourneys_tenant_id: platformTenantId,
        platform_api_base_url: "https://runtime.example.com/",
      }),
    }));
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        customerJourneysPlatformApiBaseUrl: "https://runtime.example.com",
        customerJourneysPlatformApiBaseUrlOverride: null,
        customerJourneysInternalApiToken: "internal-token",
      }),
    }));

    const route = await import("@/app/api/platform/proxy/[...path]/route");
    const response = await route.PUT(
      new Request(
        `http://localhost/api/platform/proxy/v1/internal/tenants/${platformTenantId}/resources/resource-1/working-hours`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rows: [] }),
        },
      ),
      {
        params: Promise.resolve({
          path: ["v1", "internal", "tenants", platformTenantId, "resources", "resource-1", "working-hours"],
        }),
      },
    );

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");

    vi.unstubAllGlobals();
  });

  it("prefers the process-wide base-url override over the tenant runtime link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: "2026-04-23", resources: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("@/modules/crm/lib/auth", () => ({
      requireCrmUser: vi.fn().mockResolvedValue(mockSession()),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        crm_tenant_id: tenantId,
        customerjourneys_tenant_id: platformTenantId,
        platform_api_base_url: "https://remote-runtime.example.com",
      }),
    }));
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        customerJourneysPlatformApiBaseUrl: "https://fallback-runtime.example.com",
        customerJourneysPlatformApiBaseUrlOverride: "http://127.0.0.1:4001/",
        customerJourneysInternalApiToken: "internal-token",
      }),
    }));

    const route = await import("@/app/api/platform/proxy/[...path]/route");
    const response = await route.GET(
      new Request(
        `http://localhost/api/platform/proxy/v1/internal/tenants/${platformTenantId}/calendar/availability-snapshot`,
      ),
      {
        params: Promise.resolve({
          path: ["v1", "internal", "tenants", platformTenantId, "calendar", "availability-snapshot"],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:4001/v1/internal/tenants/${platformTenantId}/calendar/availability-snapshot`,
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );

    vi.unstubAllGlobals();
  });
});
