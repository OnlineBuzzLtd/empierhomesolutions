import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("crm middleware", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users away from protected crm routes", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        enabled: true,
        url: "https://supabase.example",
        publishableKey: "anon-key",
      }),
    }));
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: vi.fn().mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      }),
    }));

    const { updateCrmSession } = await import("@/modules/crm/lib/supabase-middleware");
    const response = await updateCrmSession(new NextRequest("https://example.com/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("set-cookie")).toContain("crm_next=%2Fdashboard");
  });

  it("blocks CRM mutations while demo mode is active", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({
        enabled: true,
        url: "https://supabase.example",
        publishableKey: "anon-key",
      }),
    }));
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: vi.fn().mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
        },
      }),
    }));

    const { updateCrmSession } = await import("@/modules/crm/lib/supabase-middleware");
    const response = await updateCrmSession(
      new NextRequest("https://example.com/api/crm/quotes", {
        method: "POST",
        headers: { cookie: "crm_demo_mode=core-walkthrough" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Demo mode is read-only." });
  });
});
