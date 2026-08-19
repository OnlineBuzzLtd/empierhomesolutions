import { beforeEach, describe, expect, it, vi } from "vitest";

// Cover for GET /api/crm/leads/[id]/conversation — the CRM's read path for an
// enquiry's AI transcript.
//
// The transcript lives in the CustomerJourneys runtime, reached with a service
// token. This route exists so the browser never holds that token: it proves the
// caller may see the lead (tenant-scoped, RLS-backed) and then makes the
// upstream call itself. It must also degrade rather than break the drawer when
// the runtime is unavailable.

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

async function callRoute(opts: {
  leadId?: string;
  link?: { conversation_id: string | null; latest_channel: string | null } | null;
  conversation?: unknown;
  fetchThrows?: boolean;
  unauthenticated?: boolean;
}) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: () => chain(),
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return chain();
    },
    order: () => chain(),
    limit: () => chain(),
    maybeSingle: async () => ({ data: opts.link ?? null, error: null }),
  });
  const supabase = { schema: () => ({ from: () => builder }) };

  vi.doMock("@/modules/crm/lib/api", () => ({
    jsonError,
    jsonSuccess,
    requireCrmApiUser: vi.fn().mockResolvedValue(
      opts.unauthenticated
        ? { error: jsonError("Authentication required.", 401) }
        : { session: { supabase, tenant: { id: TENANT_ID } } },
    ),
  }));
  vi.doMock("@/modules/crm/lib/supabase-server", () => ({
    createCrmServiceRoleClient: vi.fn().mockReturnValue({}),
  }));
  vi.doMock("@/modules/crm/lib/customerjourneys", () => ({
    getCustomerJourneysRuntimeLink: vi.fn().mockResolvedValue({ customerjourneys_tenant_id: "cj-1" }),
    fetchCustomerJourneysConversation: vi.fn().mockImplementation(async () => {
      if (opts.fetchThrows) throw new Error("runtime down");
      return opts.conversation ?? null;
    }),
  }));

  const route = await import("@/app/api/crm/leads/[id]/conversation/route");
  const response = (await route.GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: opts.leadId ?? LEAD_ID }),
  })) as Response;

  return { response, body: await response.json(), filters };
}

describe("GET /api/crm/leads/[id]/conversation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the transcript for a linked conversation", async () => {
    const { response, body } = await callRoute({
      link: { conversation_id: CONVERSATION_ID, latest_channel: "webchat" },
      conversation: {
        conversationId: CONVERSATION_ID,
        messages: [{ id: "m1", direction: "inbound", body: "hello", channel: "webchat", createdAt: null }],
      },
    });

    expect(response.status).toBe(200);
    expect(body.conversation.messages).toHaveLength(1);
    expect(body.conversation.channel).toBe("webchat");
  });

  it("scopes the lead lookup to the caller's tenant", async () => {
    const { filters } = await callRoute({ link: null });

    expect(filters).toMatchObject({ tenant_id: TENANT_ID, lead_id: LEAD_ID });
  });

  it("reports a manually created enquiry as having no conversation", async () => {
    const { response, body } = await callRoute({ link: null });

    expect(response.status).toBe(200);
    expect(body.conversation).toBeNull();
    expect(body.reason).toBe("no_linked_conversation");
  });

  it("degrades instead of erroring when the runtime is down", async () => {
    const { response, body } = await callRoute({
      link: { conversation_id: CONVERSATION_ID, latest_channel: "webchat" },
      fetchThrows: true,
    });

    // The office can still action the enquiry; only the transcript panel is
    // missing.
    expect(response.status).toBe(200);
    expect(body.conversation).toBeNull();
    expect(body.reason).toBe("runtime_error");
  });

  it("rejects a non-uuid lead id", async () => {
    const { response, body } = await callRoute({ leadId: "not-a-uuid" });

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid enquiry id.");
  });

  it("requires authentication", async () => {
    const { response } = await callRoute({ unauthenticated: true });

    expect(response.status).toBe(401);
  });
});
