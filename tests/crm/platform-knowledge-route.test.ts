import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiKnowledgeResponse } from "@/modules/crm/lib/ai-knowledge";

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

const knowledge: AiKnowledgeResponse = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  version: "knowledge:catalog-v1",
  generatedAt: "2026-05-30T12:00:00.000Z",
  articles: [],
  faqs: [
    {
      id: "faq:services",
      question: "What services do you offer?",
      answer: "Empire can help with boiler service.",
      tags: ["services"],
      source: {
        sourceType: "crm_catalogue",
        sourceId: "catalogue:services",
        tenantId: "11111111-1111-4111-8111-111111111111",
        version: "catalog-v1",
        lastUpdatedAt: "2026-05-30T12:00:00.000Z",
        confidence: 1,
      },
      answerPolicy: {
        canQuote: false,
        requiresOfficeConfirmation: false,
        requiresHandoff: false,
        allowedChannels: ["webchat", "sms", "whatsapp", "voice", "email"],
      },
    },
  ],
  coverage: [],
  openingHours: [],
  policies: [],
};

describe("platform knowledge route", () => {
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
    vi.doMock("@/modules/crm/lib/ai-knowledge", () => ({
      buildAiKnowledgeForTenant: vi.fn(),
    }));

    const route = await import("@/app/api/platform/knowledge/route");
    const response = await route.GET(new Request("http://localhost/api/platform/knowledge?crmTenantId=tenant-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Missing x-platform-signature.");
  });

  it("returns the tenant knowledge contract for a valid signed request", async () => {
    const supabase = mockTenantLookup(knowledge.tenantId);
    const buildAiKnowledgeForTenant = vi.fn().mockResolvedValue(knowledge);

    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue(supabase),
    }));
    vi.doMock("@/modules/crm/lib/ai-knowledge", () => ({
      buildAiKnowledgeForTenant,
    }));

    const route = await import("@/app/api/platform/knowledge/route");
    const response = await route.GET(signedGet(`http://localhost/api/platform/knowledge?crmTenantId=${knowledge.tenantId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(buildAiKnowledgeForTenant).toHaveBeenCalledWith(supabase, knowledge.tenantId);
    expect(body.version).toBe("knowledge:catalog-v1");
    expect(body.faqs[0].answer).toContain("boiler service");
  });

  it("returns 404 for an unknown tenant", async () => {
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue(mockTenantLookup(null)),
    }));
    vi.doMock("@/modules/crm/lib/ai-knowledge", () => ({
      buildAiKnowledgeForTenant: vi.fn(),
    }));

    const route = await import("@/app/api/platform/knowledge/route");
    const response = await route.GET(signedGet("http://localhost/api/platform/knowledge?crmTenantId=missing"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Tenant not found.");
  });
});
