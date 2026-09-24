import { beforeEach, describe, expect, it, vi } from "vitest";

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";
const h = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), rpc: vi.fn(), enabled: true, editing: true }));
vi.mock("@/modules/crm/lib/api", () => ({
  requireCrmApiUser: h.auth,
  jsonError: (error: string, status = 400) => Response.json({ error }, { status }),
  jsonSuccess: (data: object) => Response.json({ ok: true, ...data }),
}));
vi.mock("@/modules/crm/lib/env", () => ({
  getCrmEnv: () => ({ multiSiteEnabled: h.enabled, siteEditingEnabled: h.editing }),
}));
import { POST } from "@/app/api/crm/sites/route";
import { PATCH, DELETE } from "@/app/api/crm/sites/[id]/route";

function query(result: object) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const key of ["select", "eq", "insert", "update"] as const) chain[key].mockReturnValue(chain);
  chain.single.mockResolvedValue(result);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}
function request(method: string, body: unknown = {}) {
  return new Request("http://localhost/api/crm/sites", { method, body: JSON.stringify(body) });
}
const ctx = { params: Promise.resolve({ id: SITE }) };

describe("site management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.enabled = true;
    h.editing = true;
    h.auth.mockResolvedValue({
      session: {
        tenant: { id: TENANT },
        supabase: {
          schema: () => ({ from: h.from, rpc: h.rpc }),
        },
      },
    });
  });

  it("creates another site scoped to the customer's workspace and demo status", async () => {
    const customer = query({
      data: { id: CUSTOMER, is_demo: true, demo_scenario_key: "core-walkthrough" },
      error: null,
    });
    const site = query({ data: { id: SITE }, error: null });
    h.from.mockReturnValueOnce(customer).mockReturnValueOnce(site);
    const response = await POST(
      request("POST", { customer_id: CUSTOMER, label: "Rental", is_primary: "on" }),
    );
    expect(response!.status).toBe(200);
    expect(h.auth).toHaveBeenCalledWith(["management", "admin", "sales"]);
    expect(customer.eq.mock.calls).toEqual([
      ["id", CUSTOMER],
      ["tenant_id", TENANT],
    ]);
    expect(site.insert).toHaveBeenCalledWith({
      customer_id: CUSTOMER,
      label: "Rental",
      is_primary: true,
      tenant_id: TENANT,
      is_demo: true,
      demo_scenario_key: "core-walkthrough",
    });
  });

  it("rejects cross-tenant or missing customers before inserting", async () => {
    h.from.mockReturnValue(query({ data: null, error: null }));
    expect((await POST(request("POST", { customer_id: CUSTOMER, label: "Rental" })))!.status).toBe(404);
    expect(h.from).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    [],
    {},
    { customer_id: CUSTOMER, label: "Rental", tenant_id: "other" },
    { customer_id: CUSTOMER, label: "Rental", is_primary: "not-a-boolean" },
  ])("rejects invalid create payload %j", async (body) => {
    expect((await POST(request("POST", body)))!.status).toBe(400);
    expect(h.from).not.toHaveBeenCalled();
  });

  it("updates a primary in a single tenant-scoped write", async () => {
    const site = query({ data: { id: SITE }, error: null });
    h.from.mockReturnValue(site);
    expect((await PATCH(request("PATCH", { is_primary: "true" }), ctx))!.status).toBe(200);
    expect(site.update).toHaveBeenCalledWith({ is_primary: true });
    expect(site.eq.mock.calls).toEqual([
      ["id", SITE],
      ["tenant_id", TENANT],
    ]);
    expect(h.from).toHaveBeenCalledTimes(1);
  });

  it("edits the primary site's address with multi-site off, preserving its identity and primary status", async () => {
    h.enabled = false;
    const address = {
      address_line1: "2 Example Road",
      address_line2: "Flat 1",
      city: "Uxbridge",
      postcode: "UB8 1AA",
      access_notes: "Use the front door",
      parking_notes: "Driveway",
    };
    const saved = { id: SITE, customer_id: CUSTOMER, is_primary: true, ...address };
    const site = query({ data: saved, error: null });
    h.from.mockReturnValue(site);
    const response = await PATCH(request("PATCH", { ...address, postcode: " UB8 1AA " }), ctx);
    expect(response!.status).toBe(200);
    expect(await response!.json()).toEqual({ ok: true, site: saved });
    expect(h.auth).toHaveBeenCalledWith(["management", "admin", "sales"]);
    expect(h.from).toHaveBeenCalledExactlyOnceWith("sites");
    expect(site.update).toHaveBeenCalledExactlyOnceWith(address);
    expect(site.eq.mock.calls).toEqual([
      ["id", SITE],
      ["tenant_id", TENANT],
    ]);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each([true, false, "true", "false"])(
    "rejects primary changes (%s), including mixed address edits, while multi-site is off",
    async (is_primary) => {
      h.enabled = false;
      const response = await PATCH(request("PATCH", { is_primary, address_line1: "2 Example Road" }), ctx);
      expect(response!.status).toBe(404);
      expect(h.from).not.toHaveBeenCalled();
    },
  );

  it("allows clearing optional site address fields", async () => {
    h.enabled = false;
    const site = query({ data: { id: SITE }, error: null });
    h.from.mockReturnValue(site);
    expect((await PATCH(request("PATCH", { address_line2: "", parking_notes: null }), ctx))!.status).toBe(
      200,
    );
    expect(site.update).toHaveBeenCalledWith({ address_line2: "", parking_notes: null });
  });

  it.each([{ customer_id: CUSTOMER }, { tenant_id: TENANT }, {}])(
    "rejects site reassignment or empty patch %j",
    async (body) => {
      expect((await PATCH(request("PATCH", body), ctx))!.status).toBe(400);
      expect(h.from).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the site is missing or hidden by RLS", async () => {
    h.from.mockReturnValue(query({ data: null, error: null }));
    expect((await PATCH(request("PATCH", { label: "Rental" }), ctx))!.status).toBe(404);
  });

  it.each(["23505", "40P01", "40001"])("returns a retryable conflict for %s", async (code) => {
    h.from.mockReturnValue(query({ data: null, error: { code, message: "conflict" } }));
    expect((await PATCH(request("PATCH", { is_primary: true }), ctx))!.status).toBe(409);
  });

  it("deletes through the locked database operation, with manager access", async () => {
    h.rpc.mockResolvedValue({ data: { id: SITE }, error: null });
    expect((await DELETE(request("DELETE"), ctx))!.status).toBe(200);
    expect(h.auth).toHaveBeenCalledWith(["management", "admin"]);
    expect(h.rpc).toHaveBeenCalledWith("delete_unused_site", { p_site_id: SITE, p_tenant_id: TENANT });
  });

  it("refuses to delete a site referenced by a job or contact", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: "23503", message: "Site is in use" } });
    expect((await DELETE(request("DELETE"), ctx))!.status).toBe(409);
  });

  it("keeps creation and deletion gated when only address editing is enabled", async () => {
    h.enabled = false;
    expect((await POST(request("POST", {})))!.status).toBe(404);
    expect((await DELETE(request("DELETE"), ctx))!.status).toBe(404);
    expect(h.from).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("blocks address edits when both flags are off (rollback)", async () => {
    h.enabled = false;
    h.editing = false;
    expect((await PATCH(request("PATCH", { postcode: "UB8 1AA" }), ctx))!.status).toBe(404);
    expect(h.from).not.toHaveBeenCalled();
  });

  it("preserves existing multi-site editing when the address rollout is off", async () => {
    h.editing = false;
    h.from.mockReturnValue(query({ data: { id: SITE }, error: null }));
    expect((await PATCH(request("PATCH", { postcode: "UB8 1AA" }), ctx))!.status).toBe(200);
  });

  it.each([null, [], { postcode: "X".repeat(17) }, { id: SITE }])(
    "rejects invalid edits with multi-site off: %j",
    async (body) => {
      h.enabled = false;
      expect((await PATCH(request("PATCH", body), ctx))!.status).toBe(400);
      expect(h.from).not.toHaveBeenCalled();
    },
  );

  it("stops at authorization failures", async () => {
    h.auth.mockResolvedValue({ error: Response.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await POST(request("POST", {})))!.status).toBe(403);
    expect((await PATCH(request("PATCH", {}), ctx))!.status).toBe(403);
    expect((await DELETE(request("DELETE"), ctx))!.status).toBe(403);
    expect(h.from).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
