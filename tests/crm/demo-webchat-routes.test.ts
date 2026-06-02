import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "11111111-1111-4111-8111-111111111111";
const activeSession = {
  id: "demo-session-1",
  tenant_id: tenantId,
  started_at: "2026-06-01T10:00:00.000Z",
  ended_at: null,
  prospect_name: "Shaz Iqbal",
  prospect_phone: "+447779305853",
};

function mockActiveDemoApi() {
  vi.doMock("@/modules/crm/demo-console/server/session-guard", () => ({
    guardDemoApi: vi.fn().mockResolvedValue({
      ok: true,
      tenantId,
      userId: "user-1",
      activeSession,
      admin: { schema: vi.fn() },
    }),
  }));
}

describe("demo webchat routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns the demo guard response when no active session exists", async () => {
    vi.doMock("@/modules/crm/demo-console/server/session-guard", () => ({
      guardDemoApi: vi.fn().mockResolvedValue({
        ok: false,
        response: Response.json({ error: "No active demo session. Capture consent first." }, { status: 409 }),
      }),
    }));

    const route = await import("@/app/api/crm/demo/webchat/session/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/session", {
        method: "POST",
        body: JSON.stringify({
          openingMessage: "Need a boiler service.",
          scenarioKey: "fixed_price_service_quote",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("No active demo session");
  });

  it("blocks scripted webchat when the demo kill switch is active", async () => {
    mockActiveDemoApi();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({
        ok: false,
        response: Response.json({ error: "Demo kill switch is active." }, { status: 423 }),
      }),
    }));

    const route = await import("@/app/api/crm/demo/webchat/session/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/session", {
        method: "POST",
        body: JSON.stringify({
          openingMessage: "Need a boiler service.",
          scenarioKey: "fixed_price_service_quote",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body.error).toContain("kill switch");
  });

  it("starts a real CJ webchat session with demo source and tags CRM rows", async () => {
    const createCustomerJourneysWebchatSession = vi.fn().mockResolvedValue({
      conversation: { id: "aaaaaaaa-1111-4111-8111-111111111111" },
      messages: [{ id: "m1", body: "Need a boiler service.", direction: "inbound" }],
      replyMessage: { id: "m2", body: "I can help with that.", direction: "outbound" },
    });
    const tagDemoWebchatRows = vi.fn().mockResolvedValue({ counts: { customers: 1 } });

    mockActiveDemoApi();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/demo-console/server/webchat-row-tagger", () => ({
      tagDemoWebchatRows,
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "runtime-1" }),
      createCustomerJourneysWebchatSession,
    }));

    const route = await import("@/app/api/crm/demo/webchat/session/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/session", {
        method: "POST",
        body: JSON.stringify({
          openingMessage: "Need a boiler service.",
          scenarioKey: "fixed_price_service_quote",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transcript.conversationId).toBe("aaaaaaaa-1111-4111-8111-111111111111");
    expect(createCustomerJourneysWebchatSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        identifierValue: "demo:demo-session-1:fixed_price_service_quote",
        fullName: "Shaz Iqbal",
        source: "demo_console_webchat",
        metadata: {
          is_test: true,
          demo_session_id: "demo-session-1",
          demo_scenario_key: "fixed_price_service_quote",
        },
      }),
    );
    expect(tagDemoWebchatRows).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        session: activeSession,
        scenarioKey: "fixed_price_service_quote",
      }),
    );
  });

  it("sends follow-up turns with demo metadata and tags CRM rows", async () => {
    const appendCustomerJourneysWebchatMessage = vi.fn().mockResolvedValue({
      message: { id: "m3", body: "Tomorrow morning.", direction: "inbound" },
      replyMessage: { id: "m4", body: "I can do 8am.", direction: "outbound" },
    });
    const tagDemoWebchatRows = vi.fn().mockResolvedValue({ counts: { jobs: 1 } });

    mockActiveDemoApi();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/demo-console/server/webchat-row-tagger", () => ({
      tagDemoWebchatRows,
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "runtime-1" }),
      appendCustomerJourneysWebchatMessage,
    }));

    const route = await import("@/app/api/crm/demo/webchat/messages/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "aaaaaaaa-1111-4111-8111-111111111111",
          body: "Tomorrow morning.",
          scenarioKey: "emergency_repair_booking",
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.transcript.replyMessage.body).toBe("I can do 8am.");
    expect(appendCustomerJourneysWebchatMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        conversationId: "aaaaaaaa-1111-4111-8111-111111111111",
        body: "Tomorrow morning.",
        source: "demo_console_webchat",
        metadata: {
          is_test: true,
          demo_session_id: "demo-session-1",
          demo_scenario_key: "emergency_repair_booking",
        },
      }),
    );
    expect(tagDemoWebchatRows).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        scenarioKey: "emergency_repair_booking",
      }),
    );
  });

  it("next-customer-turn requires an active demo session", async () => {
    vi.doMock("@/modules/crm/demo-console/server/session-guard", () => ({
      guardDemoApi: vi.fn().mockResolvedValue({
        ok: false,
        response: Response.json({ error: "No active demo session. Capture consent first." }, { status: 409 }),
      }),
    }));

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "emergency_repair_booking",
          turnIndex: 1,
          transcript: [{ direction: "outbound", body: "Can I get your phone number?" }],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("No active demo session");
  });

  it("next-customer-turn is blocked by the demo kill switch", async () => {
    mockActiveDemoApi();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({
        ok: false,
        response: Response.json({ error: "Demo kill switch is active." }, { status: 423 }),
      }),
    }));

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "emergency_repair_booking",
          turnIndex: 1,
          transcript: [{ direction: "outbound", body: "Can I get your phone number?" }],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body.error).toContain("kill switch");
  });

  it("next-customer-turn sends consolidated details when platform AI is unavailable and the AI asks an unstructured follow-up", async () => {
    mockActiveDemoApi();
    const generateCustomerJourneysDemoCustomerTurn = vi.fn().mockResolvedValue({
      status: "blocked",
      stopCode: "llm_failed",
      message: null,
      reason: "Platform AI unavailable for demo customer turns.",
    });
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "runtime-1" }),
      generateCustomerJourneysDemoCustomerTurn,
    }));

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "emergency_repair_booking",
          turnIndex: 1,
          transcript: [{ direction: "outbound", body: "Please provide your reference code." }],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
    });
    expect(body.turn.message).toContain("+447779305853");
    expect(body.turn.message).toContain("UB8 1AA");
    expect(body.turn.reason).toContain("Platform AI unavailable");
    expect(generateCustomerJourneysDemoCustomerTurn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scenarioKey: "emergency_repair_booking" }),
    );
  });

  it("next-customer-turn returns a useful blocker when platform AI is unavailable after consolidated details were sent", async () => {
    mockActiveDemoApi();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "runtime-1" }),
      generateCustomerJourneysDemoCustomerTurn: vi.fn().mockResolvedValue({
        status: "blocked",
        stopCode: "llm_not_configured",
        message: null,
        reason: "Platform AI provider is not configured for demo customer turns.",
      }),
    }));

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "emergency_repair_booking",
          turnIndex: 2,
          transcript: [
            {
              direction: "inbound",
              body: "My name is shaz, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA.",
            },
            { direction: "outbound", body: "Please provide your reference code." },
          ],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.turn).toMatchObject({
      status: "blocked",
      stopCode: "llm_not_configured",
    });
    expect(body.turn.reason).toContain("Platform AI provider");
  });

  it("next-customer-turn answers common booking prompts without a configured LLM", async () => {
    mockActiveDemoApi();
    const generateCustomerJourneysDemoCustomerTurn = vi.fn();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "runtime-1" }),
      generateCustomerJourneysDemoCustomerTurn,
    }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "emergency_repair_booking",
          turnIndex: 1,
          transcript: [{ direction: "outbound", body: "Can I get your phone number and postcode?" }],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(generateCustomerJourneysDemoCustomerTurn).not.toHaveBeenCalled();
  });

  it("next-customer-turn retries exact known fields after consolidated details without a configured LLM", async () => {
    mockActiveDemoApi();
    const generateCustomerJourneysDemoCustomerTurn = vi.fn();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "runtime-1" }),
      generateCustomerJourneysDemoCustomerTurn,
    }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "emergency_repair_booking",
          turnIndex: 2,
          transcript: [
            { direction: "outbound", body: "Can I get your phone number and postcode?" },
            {
              direction: "inbound",
              body: "My name is shaz, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA.",
            },
            { direction: "outbound", body: "Can I get your phone number and postcode?" },
          ],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
    });
    expect(body.turn.reason).toContain("exact scenario detail");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(generateCustomerJourneysDemoCustomerTurn).not.toHaveBeenCalled();
  });

  it("next-customer-turn calls the Customer Journeys platform helper for adaptive AI turns", async () => {
    mockActiveDemoApi();
    const runtimeLink = { customerjourneys_tenant_id: "runtime-1" };
    const generateCustomerJourneysDemoCustomerTurn = vi.fn().mockResolvedValue({
      status: "message",
      stopCode: "next_message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
      reason: "Answering the AI question.",
    });
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue(runtimeLink),
      generateCustomerJourneysDemoCustomerTurn,
    }));

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "emergency_repair_booking",
          turnIndex: 1,
          transcript: [{ direction: "outbound", body: "Please provide any extra context for the office." }],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.turn).toMatchObject({
      status: "message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
    });
    expect(generateCustomerJourneysDemoCustomerTurn).toHaveBeenCalledWith(
      runtimeLink,
      expect.objectContaining({
        scenarioKey: "emergency_repair_booking",
        prospectName: "Shaz Iqbal",
        prospectPhone: "+447779305853",
      }),
    );
  });

  it("next-customer-turn preserves unsafe platform AI blockers", async () => {
    mockActiveDemoApi();
    vi.doMock("@/modules/crm/demo-console/server/demo-kill-switch", () => ({
      guardDemoKillSwitchClear: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
      getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "runtime-1" }),
      generateCustomerJourneysDemoCustomerTurn: vi.fn().mockResolvedValue({
        status: "blocked",
        stopCode: "unsafe_llm_output",
        message: null,
        reason: "Platform AI returned an empty message.",
      }),
    }));

    const route = await import("@/app/api/crm/demo/webchat/next-customer-turn/route");
    const response = (await route.POST(
      new Request("http://localhost/api/crm/demo/webchat/next-customer-turn", {
        method: "POST",
        body: JSON.stringify({
          scenarioKey: "fixed_price_service_quote",
          turnIndex: 1,
          transcript: [{ direction: "outbound", body: "Please provide any extra context for the office." }],
        }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.turn).toMatchObject({
      status: "blocked",
      stopCode: "unsafe_llm_output",
    });
  });
});
