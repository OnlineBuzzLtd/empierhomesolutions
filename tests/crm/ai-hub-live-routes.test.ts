import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeTenantId = "75d76e43-4e5e-4568-8ff2-e2594c9818f9";

const managerSession = {
  supabase: {},
  user: {
    id: "user-1",
    email: "alex@example.com",
    user_metadata: {
      full_name: "Alex Manager",
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-04-07T10:00:00.000Z",
  },
  profile: {
    role: "management",
    full_name: "Alex Manager",
  },
  membership: {
    id: "membership-1",
    tenant_id: "11111111-1111-4111-8111-111111111111",
  },
  tenant: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Empire Home Solutions",
  },
  branding: null,
  settings: null,
};

describe("channel test routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads the linked runtime snapshot for a manager", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({ session: managerSession }),
      jsonError: (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status }),
      jsonSuccess: (data: Record<string, unknown>) => new Response(JSON.stringify({ ok: true, ...data }), { status: 200 }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      loadChannelTestRuntimeSnapshot: vi.fn().mockResolvedValue({
        link: {
          crm_tenant_id: "11111111-1111-4111-8111-111111111111",
          customerjourneys_tenant_id: runtimeTenantId,
        },
        runtime: {
          tenant: {
            id: runtimeTenantId,
            slug: "empire-home-solutions",
            name: "Empire Runtime",
            verticalKey: "plumbing",
          },
          runtimeMode: "platform_ai",
          bookingResourceCount: 2,
          issues: [],
          channels: {
            webchat: { enabled: true, ready: true, displayNumber: null, deepLink: null, reason: null },
            sms: { enabled: true, ready: true, displayNumber: "+441895725151", deepLink: null, reason: null },
            whatsapp: { enabled: true, ready: true, displayNumber: "+441895725151", deepLink: "https://wa.me/441895725151", reason: null },
            voice: { enabled: true, ready: true, displayNumber: "+441895725151", deepLink: null, reason: null },
          },
        },
        recentRecords: [],
        runtimeConfigured: true,
        usingFixtures: false,
      }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));

    const route = await import("@/app/api/crm/channel-test/runtime/route");
    const response = (await route.GET()) as Response;
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.snapshot.runtime.tenant.name).toBe("Empire Runtime");
    expect(json.snapshot.runtime.channels.sms.displayNumber).toBe("+441895725151");
  });

  it("creates a linked webchat session", async () => {
    const getCustomerJourneysRuntimeLink = vi.fn().mockResolvedValue({
      crm_tenant_id: "11111111-1111-4111-8111-111111111111",
      customerjourneys_tenant_id: runtimeTenantId,
      auth_mode: "internal_service",
      platform_api_base_url: "https://runtime.example.com",
    });
    const createCustomerJourneysWebchatSession = vi.fn().mockResolvedValue({
      conversation: {
        id: "aaaaaaaa-1111-4111-8111-111111111111",
      },
      messages: [],
      bookingState: null,
      replyMessage: null,
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({ session: managerSession }),
      jsonError: (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status }),
      jsonSuccess: (data: Record<string, unknown>) => new Response(JSON.stringify({ ok: true, ...data }), { status: 200 }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink,
      createCustomerJourneysWebchatSession,
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));

    const route = await import("@/app/api/crm/channel-test/webchat/sessions/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/channel-test/webchat/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifierValue: "jane@example.com",
          fullName: "Jane Smith",
          email: "jane@example.com",
          openingMessage: "Need a boiler service.",
        }),
      }),
    )) as Response;
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(createCustomerJourneysWebchatSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customerjourneys_tenant_id: runtimeTenantId,
      }),
      expect.objectContaining({
        fullName: "Jane Smith",
        email: "jane@example.com",
      }),
    );
    expect(json.session.conversation.id).toBe("aaaaaaaa-1111-4111-8111-111111111111");
  });

  it("sends a linked webchat message", async () => {
    const appendCustomerJourneysWebchatMessage = vi.fn().mockResolvedValue({
      message: {
        id: "bbbbbbbb-1111-4111-8111-111111111111",
        body: "UB8 1AA",
        direction: "inbound",
        createdAt: "2026-04-07T10:01:00.000Z",
      },
      replyMessage: {
        id: "cccccccc-1111-4111-8111-111111111111",
        body: "Booked for Thursday 10:00-11:00.",
        direction: "outbound",
        createdAt: "2026-04-07T10:01:04.000Z",
      },
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      requireManagerCrmApiUser: vi.fn().mockResolvedValue({ session: managerSession }),
      jsonError: (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status }),
      jsonSuccess: (data: Record<string, unknown>) => new Response(JSON.stringify({ ok: true, ...data }), { status: 200 }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({
        crm_tenant_id: "11111111-1111-4111-8111-111111111111",
        customerjourneys_tenant_id: runtimeTenantId,
        auth_mode: "internal_service",
        platform_api_base_url: "https://runtime.example.com",
      }),
      appendCustomerJourneysWebchatMessage,
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
    }));

    const route = await import("@/app/api/crm/channel-test/webchat/messages/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/channel-test/webchat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "aaaaaaaa-1111-4111-8111-111111111111",
          body: "UB8 1AA",
        }),
      }),
    )) as Response;
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(appendCustomerJourneysWebchatMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        conversationId: "aaaaaaaa-1111-4111-8111-111111111111",
        body: "UB8 1AA",
      }),
    );
    expect(json.session.replyMessage.body).toBe("Booked for Thursday 10:00-11:00.");
  });
});
