import { beforeEach, describe, expect, it, vi } from "vitest";

// Cover for PATCH /api/crm/settings/users/[user_id]/status — the route that
// activates and deactivates a team member. It had no test despite being the
// route that decides whether someone can log in at all.
//
// Deactivation is deliberately soft: it flips `active` on both
// crm.user_profiles and crm.tenant_memberships, leaving historic
// crm.job_assignees and crm.user_certifications rows intact (both cascade on
// delete, so a hard delete would silently erase job history).

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const TARGET_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

type Harness = {
  response: Response;
  body: Record<string, unknown>;
  profileUpdate: ReturnType<typeof vi.fn>;
  membershipUpdate: ReturnType<typeof vi.fn>;
};

async function patchStatus(opts: {
  userId?: string;
  active: boolean;
  activeManagers?: Array<{ user_id: string }>;
  profileRow?: Record<string, unknown> | null;
}): Promise<Harness> {
  const {
    userId = TARGET_ID,
    active,
    activeManagers = [{ user_id: ACTOR_ID }, { user_id: TARGET_ID }],
    profileRow = { id: "profile-1", user_id: TARGET_ID, active },
  } = opts;

  const profileUpdate = vi.fn().mockReturnValue({
    eq: () => ({
      eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: profileRow, error: null }) }) }),
    }),
  });
  const membershipUpdate = vi.fn().mockReturnValue({
    eq: () => ({ eq: async () => ({ error: null }) }),
  });
  // The last-admin lookup: select(...).eq().eq().in()
  const membershipSelect = vi.fn().mockReturnValue({
    eq: () => ({ eq: () => ({ in: async () => ({ data: activeManagers, error: null }) }) }),
  });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "user_profiles") return { update: profileUpdate };
    if (table === "tenant_memberships") return { update: membershipUpdate, select: membershipSelect };
    throw new Error(`unexpected table ${table}`);
  });
  const supabase = { schema: vi.fn().mockReturnValue({ from }) };

  vi.doMock("@/modules/crm/lib/api", () => ({
    jsonError,
    jsonSuccess,
    requireManagerCrmApiUser: vi.fn().mockResolvedValue({
      session: { supabase, tenant: { id: TENANT_ID }, user: { id: ACTOR_ID } },
    }),
  }));

  const route = await import("@/app/api/crm/settings/users/[user_id]/status/route");
  const request = new Request("http://localhost", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ active }),
  });
  const response = (await route.PATCH(request, {
    params: Promise.resolve({ user_id: userId }),
  })) as Response;

  return { response, body: await response.json(), profileUpdate, membershipUpdate };
}

describe("PATCH /api/crm/settings/users/[user_id]/status", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reactivates a deactivated member on both tables", async () => {
    const { response, profileUpdate, membershipUpdate } = await patchStatus({ active: true });

    expect(response.status).toBe(200);
    expect(profileUpdate).toHaveBeenCalledWith({ active: true });
    // Membership is what actually gates login — reactivating the profile alone
    // would leave the person locked out.
    expect(membershipUpdate).toHaveBeenCalledWith({ active: true });
  });

  it("deactivates a member when other admins remain", async () => {
    const { response, profileUpdate, membershipUpdate } = await patchStatus({ active: false });

    expect(response.status).toBe(200);
    expect(profileUpdate).toHaveBeenCalledWith({ active: false });
    expect(membershipUpdate).toHaveBeenCalledWith({ active: false });
  });

  it("refuses to deactivate your own account", async () => {
    const { response, body, profileUpdate } = await patchStatus({
      userId: ACTOR_ID,
      active: false,
    });

    expect(response.status).toBe(400);
    expect(body.error).toBe("You cannot deactivate your own account.");
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the last active admin", async () => {
    // crm.is_manager_or_admin requires an ACTIVE membership, so switching off
    // the final admin would leave nobody able to switch anyone back on.
    const { response, body, profileUpdate } = await patchStatus({
      active: false,
      activeManagers: [{ user_id: TARGET_ID }],
    });

    expect(response.status).toBe(400);
    expect(body.error).toContain("last active admin");
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("allows deactivating a non-admin even when only one admin exists", async () => {
    const { response, profileUpdate } = await patchStatus({
      active: false,
      activeManagers: [{ user_id: ACTOR_ID }],
    });

    expect(response.status).toBe(200);
    expect(profileUpdate).toHaveBeenCalledWith({ active: false });
  });

  it("rejects a non-uuid user id", async () => {
    const { response, body } = await patchStatus({ userId: "not-a-uuid", active: true });

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid user id.");
  });

  it("404s when the member does not belong to this tenant", async () => {
    const { response, body } = await patchStatus({ active: true, profileRow: null });

    expect(response.status).toBe(404);
    expect(body.error).toBe("User not found for this tenant.");
  });
});
