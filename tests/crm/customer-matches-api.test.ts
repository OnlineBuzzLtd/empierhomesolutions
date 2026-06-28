import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

describe("CRM customer matches API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns tenant-filtered customer matches with active work warnings", async () => {
    const searchCustomerMatchCandidates = vi.fn().mockResolvedValue([
      {
        customer: { id: "customer-1", full_name: "Jane Smith", phone: "07777123456", email: null, postcode: "UB8 1AA" },
        score: 100,
        reasons: ["same phone"],
        activeLeadCount: 1,
        activeJobCount: 2,
      },
    ]);

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({ session: { tenant: { id: "tenant-1" } } }),
    }));
    vi.doMock("@/modules/crm/lib/demo-state", () => ({
      getCrmDemoState: vi.fn().mockResolvedValue({ mode: "live", active: false }),
    }));
    vi.doMock("@/modules/crm/lib/data", () => ({
      searchCustomerMatchCandidates,
    }));

    const route = await import("@/app/api/crm/customers/matches/route");
    const response = (await route.GET!(
      new Request("http://localhost/api/crm/customers/matches?name=Jane&phone=07777123456&postcode=UB8"),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(searchCustomerMatchCandidates).toHaveBeenCalledWith(
      {
        fullName: "Jane",
        phone: "07777123456",
        email: null,
        postcode: "UB8",
      },
      "live",
    );
    expect(body.candidates).toEqual([
      expect.objectContaining({
        activeLeadCount: 1,
        activeJobCount: 2,
      }),
    ]);
  });
});
