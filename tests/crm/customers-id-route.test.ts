import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression cover for the customer PATCH route.
//
// 2026-08-19: every customer edit in the CRM returned a non-JSON 500 that the
// UI surfaced as "Unexpected response." The route called
// `customerSchema.partial()`, and `customerSchema` ends in a `.superRefine(...)`.
// zod 4 throws at runtime on `.partial()` over a refined object schema, and
// TypeScript does not catch it — so nothing before production noticed. There was
// no test for this route at all, which is why it shipped.
//
// The tests below assert the route's stated contract: a partial patch parses,
// `archived` is never written unless the caller sent it, and bad input returns
// JSON rather than an unhandled throw.

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

const CUSTOMER_ID = "3f1d5e6c-1c2b-4a3d-8e9f-0a1b2c3d4e5f";

type PatchHarness = {
  response: Response;
  body: Record<string, string>;
  update: ReturnType<typeof vi.fn>;
};

async function patchCustomer(payload: unknown | string): Promise<PatchHarness> {
  const row = {
    id: CUSTOMER_ID,
    tenant_id: "tenant-1",
    full_name: "Jackie White",
    first_name: "Jackie",
    last_name: "White",
    phone: "07700 900111",
    email: "jackiewhite3112@gmail.com",
    postcode: "RG27 0NS",
    address_line1: null,
    city: null,
    archived: false,
    source: null,
    updated_at: "2026-08-19T10:00:00.000Z",
  };

  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  const schema = vi.fn().mockReturnValue({ from });
  const supabase = { schema };

  vi.doMock("@/modules/crm/lib/api", () => ({
    jsonError,
    jsonSuccess,
    normalizeBlankFields: <T,>(value: T) => value,
    parseIdList: vi.fn().mockReturnValue([]),
    requireCrmApiUser: vi.fn().mockResolvedValue({
      session: { supabase, tenant: { id: "tenant-1" } },
    }),
  }));
  vi.doMock("@/modules/crm/lib/custom-fields", () => ({
    extractCustomFieldValues: vi.fn().mockReturnValue([]),
    upsertCustomFieldValues: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/modules/platform/lib/outbox", () => ({
    enqueueCrmPlatformEvent: vi.fn().mockResolvedValue(undefined),
    publishPendingPlatformOutboxEvents: vi.fn().mockResolvedValue(undefined),
  }));

  const route = await import("@/app/api/crm/customers/[id]/route");
  const request = new Request("http://localhost", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
  const response = (await route.PATCH!(request, {
    params: Promise.resolve({ id: CUSTOMER_ID }),
  })) as Response;

  return { response, body: await response.json(), update };
}

describe("PATCH /api/crm/customers/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("saves a name, email and postcode edit", async () => {
    // The exact edit reported as failing: rename "Jackie" to "Jackie White",
    // add an email, set the postcode.
    const { response, body, update } = await patchCustomer({
      full_name: "Jackie White",
      email: "jackiewhite3112@gmail.com",
      postcode: "RG27 0NS",
    });

    expect(response.status).toBe(200);
    expect(body.customer).toMatchObject({ full_name: "Jackie White" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Jackie White",
        email: "jackiewhite3112@gmail.com",
        postcode: "RG27 0NS",
      }),
    );
  });

  it("accepts a partial patch that touches no name field", async () => {
    const { response, update } = await patchCustomer({ phone: "07700 900222" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ phone: "07700 900222" });
  });

  it("does not write archived when the caller omits it", async () => {
    // `archived` carries a `.default(false)` on the create schema. If the patch
    // schema inherited that default, every edit would silently un-archive the
    // customer.
    const { update } = await patchCustomer({ phone: "07700 900222" });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).not.toHaveProperty("archived");
  });

  it("still writes archived when the caller sends it", async () => {
    const { update } = await patchCustomer({ archived: true });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });

  it("rejects an edit that blanks every name field", async () => {
    // Empty strings trip `full_name`'s own min(2) check before the refinement
    // runs, so the message is zod's rather than ours. What matters is that it is
    // a JSON 400 the form can display, not an unhandled 500.
    const { response, body } = await patchCustomer({
      full_name: "",
      first_name: "",
      last_name: "",
    });

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("rejects an edit that nulls every name field", async () => {
    // Nulls pass the field-level checks, so this is the path that actually
    // exercises the name invariant on the patch schema.
    const { response, body } = await patchCustomer({
      full_name: null,
      first_name: null,
      last_name: null,
    });

    expect(response.status).toBe(400);
    expect(body.error).toBe("Enter a name for the customer.");
  });

  it("returns a JSON 400 for a malformed body rather than throwing", async () => {
    const { response, body } = await patchCustomer("not-json-at-all");

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid customer payload.");
  });
});
