import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

function createSettingsSupabase() {
  const single = vi.fn().mockResolvedValue({ data: { id: "settings-1" }, error: null });
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  const from = vi.fn((table: string) => {
    if (table !== "tenant_settings") throw new Error(`Unexpected table ${table}`);
    return { upsert };
  });
  return { supabase: { schema: vi.fn(() => ({ from })) }, upsert };
}

describe("CRM settings routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves tenant review platform settings", async () => {
    const { supabase, upsert } = createSettingsSupabase();
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/reviews/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          review_requests_enabled: "on",
          review_primary_platform: "google",
          review_google_place_id: "place-1",
          review_trustpilot_url: "",
          review_facebook_url: "",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        review_requests_enabled: true,
        review_primary_platform: "google",
        review_google_place_id: "place-1",
      }),
      { onConflict: "tenant_id" },
    );
  });

  it("saves FSM provider settings and returns connection status", async () => {
    const { supabase, upsert } = createSettingsSupabase();
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/fsm/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          fsm_provider: "servicem8",
          api_key: "svc-key",
          account_id: "acct-1",
          base_url: "",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connection).toMatchObject({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        fsm_provider: "servicem8",
        fsm_config: expect.objectContaining({ api_key: "svc-key", account_id: "acct-1" }),
      }),
      { onConflict: "tenant_id" },
    );
  });

  it("saves payment provider settings", async () => {
    const { supabase, upsert } = createSettingsSupabase();
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" } },
      }),
    }));

    const route = await import("@/app/api/crm/settings/payments/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          payment_primary_provider: "stripe",
          stripe_account_id: "acct_stripe",
          gocardless_merchant_id: "",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        payment_primary_provider: "stripe",
        stripe_account_id: "acct_stripe",
        gocardless_merchant_id: null,
      }),
      { onConflict: "tenant_id" },
    );
  });
});
