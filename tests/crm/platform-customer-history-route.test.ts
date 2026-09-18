import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function identifierHash(type: "phone" | "email", value: string) {
  const normalized =
    type === "email"
      ? value.trim().toLowerCase()
      : `${value.trim().startsWith("+") ? "+" : ""}${value.replace(/^whatsapp:/i, "").replace(/\D+/g, "")}`;
  return `${type}:${createHash("sha256").update(normalized).digest("hex")}`;
}

function queryBuilder<T>(result: { data: T; error?: unknown }, single?: { data: unknown; error?: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: result.data, error: result.error ?? null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: single?.data ?? null, error: single?.error ?? null }),
  };
  return builder;
}

function mockSupabase(input: {
  tenantId: string | null;
  customers?: unknown[];
  jobs?: unknown[];
}) {
  const tenants = queryBuilder({ data: [] }, { data: input.tenantId ? { id: input.tenantId } : null });
  const customers = queryBuilder({ data: input.customers ?? [] });
  const jobs = queryBuilder({ data: input.jobs ?? [] });
  const from = vi.fn((table: string) => {
    if (table === "tenants") return tenants;
    if (table === "customers") return customers;
    if (table === "jobs") return jobs;
    throw new Error(`unexpected table ${table}`);
  });
  return {
    schema: vi.fn().mockReturnValue({ from }),
    queries: { tenants, customers, jobs, from },
  };
}

describe("platform customer-history route", () => {
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

    const route = await import("@/app/api/platform/customer-history/route");
    const response = await route.GET(new Request("http://localhost/api/platform/customer-history?crmTenantId=tenant-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Missing x-platform-signature.");
  });

  it("returns safe customer history for a signed hashed identifier lookup", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const supabase = mockSupabase({
      tenantId,
      customers: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          tenant_id: tenantId,
          phone: "+44 7700 900123",
          email: "sarah@example.com",
          city: "Uxbridge",
          postcode: "UB8 2AA",
          archived: false,
          is_test: true,
          is_demo: false,
          record_deleted_at: null,
          redacted_at: null,
        },
      ],
      jobs: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          customer_id: "22222222-2222-4222-8222-222222222222",
          title: "Boiler annual service",
          description: "Annual service completed.",
          scheduled_date: "2026-06-01",
          scheduled_time: "09:00:00",
          status: "completed",
          assigned_engineer: "James",
          created_at: "2026-05-31T10:00:00.000Z",
          updated_at: "2026-06-01T10:30:00.000Z",
          is_test: true,
          is_demo: false,
          service: { slug: "boilers", name: "Boilers" },
          job_type: { slug: "boiler-service", name: "Boiler Service" },
        },
      ],
    });

    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue(supabase),
    }));

    const route = await import("@/app/api/platform/customer-history/route");
    const url = new URL("http://localhost/api/platform/customer-history");
    url.searchParams.set("crmTenantId", tenantId);
    url.searchParams.append("identifierHash", identifierHash("phone", "+447700900123"));
    url.searchParams.append("identifierHash", identifierHash("email", "sarah@example.com"));
    const response = await route.GET(signedGet(url.toString()));
    const body = await response.json();
    const bodyText = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.tenantId).toBe(tenantId);
    expect(body.customerId).toBe("22222222-2222-4222-8222-222222222222");
    expect(body.matchedIdentifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "phone", valueHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
        expect.objectContaining({ type: "email", valueHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
      ]),
    );
    expect(body.recentJobs[0]).toMatchObject({
      jobId: "33333333-3333-4333-8333-333333333333",
      serviceKey: "boilers:boiler-service",
      serviceName: "Boilers - Boiler Service",
      status: "completed",
      addressArea: "Uxbridge",
      completedAt: "2026-06-01",
      engineerName: "James",
      outcome: "Annual service completed.",
      isTest: true,
    });
    expect(body.source).toMatchObject({
      sourceType: "crm_customer_history",
      sourceId: "customer:22222222-2222-4222-8222-222222222222",
      tenantId,
    });
    expect(bodyText).not.toContain("sarah@example.com");
    expect(bodyText).not.toContain("+44 7700");
    expect(bodyText).not.toContain("UB8 2AA");
  });

  it("returns 204 when no identifier or customer match is available", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const supabase = mockSupabase({ tenantId, customers: [], jobs: [] });

    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue(supabase),
    }));

    const route = await import("@/app/api/platform/customer-history/route");
    const noIdentifier = await route.GET(signedGet(`http://localhost/api/platform/customer-history?crmTenantId=${tenantId}`));
    const noMatchUrl = new URL("http://localhost/api/platform/customer-history");
    noMatchUrl.searchParams.set("crmTenantId", tenantId);
    noMatchUrl.searchParams.set("identifierHash", identifierHash("email", "missing@example.com"));
    const noMatch = await route.GET(signedGet(noMatchUrl.toString()));

    expect(noIdentifier.status).toBe(204);
    expect(noMatch.status).toBe(204);
  });
});
