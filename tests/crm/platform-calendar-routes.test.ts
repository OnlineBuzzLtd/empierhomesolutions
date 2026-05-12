import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase I — tests for the 7 CRM calendar endpoints. Each test sets
// up the Supabase service-role mock with a tightly-scoped builder
// chain that the route hits, then signs the request and asserts the
// response.
//
// The fluent supabase mock returns a different shape depending on
// the terminal method (.maybeSingle / .single / .limit). We build it
// per-test rather than sharing because the chain assertions matter
// (e.g. .neq("status", "cancelled")) and a shared spy makes test
// failures hard to read.

const SECRET = "test-platform-secret";

function sign(rawBody: string, secret = SECRET, timestamp?: string) {
  const ts = timestamp ?? Math.floor(Date.now() / 1000).toString();
  const sig = `sha256=${createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex")}`;
  return { timestamp: ts, signature: sig };
}

function makeRequest(
  url: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown,
  opts: { secret?: string; timestamp?: string; signatureOverride?: string } = {},
) {
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const { timestamp, signature } = sign(rawBody, opts.secret ?? SECRET, opts.timestamp);
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-platform-timestamp": timestamp,
      "x-platform-signature": opts.signatureOverride ?? signature,
    },
    body: method === "GET" || method === "DELETE" ? undefined : rawBody,
  });
}

function makeAppointmentSelectQuery(
  maybeSingle: ReturnType<typeof vi.fn>,
): { eq: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> } {
  const query = {
    eq: vi.fn(),
    maybeSingle,
  };
  query.eq.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/platform/calendar/connection", () => {
  it("returns connectedAccountEmail + scopes on signed request", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const route = await import("@/app/api/platform/calendar/connection/route");
    const response = await route.GET(makeRequest("http://localhost/api/platform/calendar/connection", "GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.scopes).toEqual(expect.arrayContaining(["read", "write"]));
    expect(typeof body.connectedAccountEmail).toBe("string");
  });

  it("rejects unsigned requests with 401", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const route = await import("@/app/api/platform/calendar/connection/route");
    const unsigned = new Request("http://localhost/api/platform/calendar/connection", { method: "GET" });
    const response = await route.GET(unsigned);
    expect(response.status).toBe(401);
  });

  it("rejects stale-timestamp requests (>5 min skew) with 401", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const route = await import("@/app/api/platform/calendar/connection/route");
    const ancient = Math.floor(Date.now() / 1000) - 60 * 60; // 1 hour ago
    const response = await route.GET(
      makeRequest("http://localhost/api/platform/calendar/connection", "GET", undefined, { timestamp: String(ancient) }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 503 if the shared secret is unconfigured", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: undefined }),
    }));
    const route = await import("@/app/api/platform/calendar/connection/route");
    const response = await route.GET(makeRequest("http://localhost/api/platform/calendar/connection", "GET"));
    expect(response.status).toBe(503);
  });
});

describe("GET /api/platform/calendar/resources", () => {
  it("lists active engineers as resources", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const orderFn = vi.fn().mockResolvedValue({
      data: [
        { id: "engineer-1", full_name: "James Golding", role: "engineer", active: true },
        { id: "engineer-2", full_name: "Sarah Bashir", role: "engineer", active: true },
      ],
      error: null,
    });
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({ order: orderFn }),
              }),
            }),
          }),
        }),
      }),
    }));

    const route = await import("@/app/api/platform/calendar/resources/route");
    const response = await route.GET(makeRequest("http://localhost/api/platform/calendar/resources", "GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resources).toHaveLength(2);
    expect(body.resources[0]).toMatchObject({
      externalId: "engineer-1",
      displayName: "James Golding",
      primary: true,
    });
    expect(body.resources[1].primary).toBe(false);
  });

  it("returns an empty list when no engineers are active", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({ eq: () => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/resources/route");
    const response = await route.GET(makeRequest("http://localhost/api/platform/calendar/resources", "GET"));
    const body = await response.json();
    expect(body.resources).toEqual([]);
  });
});

describe("POST /api/platform/calendar/check-availability", () => {
  it("returns available=true when no overlapping appointments", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                neq: () => ({ lt: () => ({ gt: () => ({ limit: limitFn }) }) }),
              }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/check-availability/route");
    const body = {
      resourceRef: "engineer-1",
      startTime: "2026-05-18T08:00:00.000Z",
      endTime: "2026-05-18T09:00:00.000Z",
    };
    const response = await route.POST(makeRequest("http://localhost/api/platform/calendar/check-availability", "POST", body));
    expect(response.status).toBe(200);
    expect((await response.json()).available).toBe(true);
  });

  it("returns available=false when an overlapping appointment exists", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                neq: () => ({
                  lt: () => ({ gt: () => ({ limit: vi.fn().mockResolvedValue({ data: [{ id: "appt-1" }], error: null }) }) }),
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/check-availability/route");
    const body = {
      resourceRef: "engineer-1",
      startTime: "2026-05-18T08:00:00.000Z",
      endTime: "2026-05-18T09:00:00.000Z",
    };
    const response = await route.POST(makeRequest("http://localhost/api/platform/calendar/check-availability", "POST", body));
    expect((await response.json()).available).toBe(false);
  });

  it("rejects an endTime <= startTime with 400", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({ createCrmServiceRoleClient: () => ({}) }));
    const route = await import("@/app/api/platform/calendar/check-availability/route");
    const body = {
      resourceRef: "engineer-1",
      startTime: "2026-05-18T09:00:00.000Z",
      endTime: "2026-05-18T08:00:00.000Z",
    };
    const response = await route.POST(makeRequest("http://localhost/api/platform/calendar/check-availability", "POST", body));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/platform/calendar/events (createHold)", () => {
  it("inserts a new appointment and returns providerReference (no existing row)", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const engineerMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "engineer-1", user_id: "auth-user-1", tenant_id: "tenant-1", active: true }, error: null });
    const lookupMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: "appt-uuid-1" }, error: null });
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: (table: string) => {
            if (table === "user_profiles") {
              return {
                select: () => ({ eq: () => ({ maybeSingle: engineerMaybeSingle }) }),
              };
            }
            // appointments — find-then-insert
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({ maybeSingle: lookupMaybeSingle }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({ single: insertSingle }),
              }),
            };
          },
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/route");
    const body = {
      resourceRef: "engineer-1",
      bookingId: "booking-uuid-abc",
      leadId: "lead-uuid-xyz",
      startTime: "2026-05-18T08:00:00.000Z",
      endTime: "2026-05-18T09:00:00.000Z",
      summary: "Boiler service — Sarah",
    };
    const response = await route.POST(makeRequest("http://localhost/api/platform/calendar/events", "POST", body));
    expect(response.status).toBe(200);
    expect((await response.json()).providerReference).toBe("appt-uuid-1");
    expect(insertSingle).toHaveBeenCalledTimes(1);
  });

  it("updates the existing appointment when one already exists for the same bookingId", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const engineerMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "engineer-1", user_id: "auth-user-1", tenant_id: "tenant-1", active: true }, error: null });
    const lookupMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "existing-appt-uuid" }, error: null });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const insertSingle = vi.fn();
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: (table: string) => {
            if (table === "user_profiles") {
              return {
                select: () => ({ eq: () => ({ maybeSingle: engineerMaybeSingle }) }),
              };
            }
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({ maybeSingle: lookupMaybeSingle }),
                  }),
                }),
              }),
              update: () => ({ eq: updateEq }),
              insert: () => ({
                select: () => ({ single: insertSingle }),
              }),
            };
          },
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/route");
    const body = {
      resourceRef: "engineer-1",
      bookingId: "booking-uuid-abc",
      leadId: "lead-uuid-xyz",
      startTime: "2026-05-18T08:00:00.000Z",
      endTime: "2026-05-18T09:00:00.000Z",
    };
    const response = await route.POST(makeRequest("http://localhost/api/platform/calendar/events", "POST", body));
    expect(response.status).toBe(200);
    expect((await response.json()).providerReference).toBe("existing-appt-uuid");
    expect(updateEq).toHaveBeenCalledTimes(1);
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("returns 400 when resourceRef is unknown", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/route");
    const body = {
      resourceRef: "engineer-unknown",
      bookingId: "b",
      leadId: "l",
      startTime: "2026-05-18T08:00:00.000Z",
      endTime: "2026-05-18T09:00:00.000Z",
    };
    const response = await route.POST(makeRequest("http://localhost/api/platform/calendar/events", "POST", body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_resource_ref");
  });

  it("returns 409 when the engineer is inactive", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "engineer-x", user_id: "auth-user-x", tenant_id: "tenant-1", active: false },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/route");
    const body = {
      resourceRef: "engineer-x",
      bookingId: "b",
      leadId: "l",
      startTime: "2026-05-18T08:00:00.000Z",
      endTime: "2026-05-18T09:00:00.000Z",
    };
    const response = await route.POST(makeRequest("http://localhost/api/platform/calendar/events", "POST", body));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("resource_inactive");
  });
});

describe("POST /api/platform/calendar/events/[bookingId]/confirm", () => {
  it("returns 200 when the appointment exists and is scheduled", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: { id: "appt-1", status: "scheduled" }, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/confirm/route");
    const response = await route.POST(
      makeRequest("http://localhost/api/platform/calendar/events/booking-abc/confirm", "POST", {}),
      { params: Promise.resolve({ bookingId: "booking-abc" }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });

  it("returns 200 when the path is the CRM providerReference appointment id", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const providerReference = "11111111-1111-4111-8111-111111111111";
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: providerReference, external_id: "booking-abc", status: "scheduled" },
        error: null,
      });
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => makeAppointmentSelectQuery(maybeSingle),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/confirm/route");
    const response = await route.POST(
      makeRequest(`http://localhost/api/platform/calendar/events/${providerReference}/confirm`, "POST", {}),
      { params: Promise.resolve({ bookingId: providerReference }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("returns 404 when no platform-sourced appointment exists for that bookingId", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/confirm/route");
    const response = await route.POST(
      makeRequest("http://localhost/api/platform/calendar/events/unknown/confirm", "POST", {}),
      { params: Promise.resolve({ bookingId: "unknown" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns 409 when the appointment is cancelled", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: { id: "appt-1", status: "cancelled" }, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/confirm/route");
    const response = await route.POST(
      makeRequest("http://localhost/api/platform/calendar/events/booking-abc/confirm", "POST", {}),
      { params: Promise.resolve({ bookingId: "booking-abc" }) },
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("event_cancelled");
  });
});

describe("DELETE + GET /api/platform/calendar/events/[bookingId]", () => {
  it("DELETE: updates status='cancelled' and returns 200", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "appt-1", external_id: "booking-abc", status: "scheduled" }, error: null });
    const updateChain = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => makeAppointmentSelectQuery(maybeSingle),
            update: () => ({ eq: () => ({ eq: updateChain }) }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/route");
    const response = await route.DELETE(
      makeRequest("http://localhost/api/platform/calendar/events/booking-abc", "DELETE"),
      { params: Promise.resolve({ bookingId: "booking-abc" }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });

  it("DELETE: accepts the CRM providerReference appointment id", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const providerReference = "22222222-2222-4222-8222-222222222222";
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: providerReference, external_id: "booking-abc", status: "scheduled" },
        error: null,
      });
    const updateChain = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => makeAppointmentSelectQuery(maybeSingle),
            update: () => ({ eq: () => ({ eq: updateChain }) }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/route");
    const response = await route.DELETE(
      makeRequest(`http://localhost/api/platform/calendar/events/${providerReference}`, "DELETE"),
      { params: Promise.resolve({ bookingId: providerReference }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
    expect(updateChain).toHaveBeenCalledTimes(1);
  });

  it("GET: maps scheduled → 'confirmed'", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { status: "scheduled" }, error: null }) }),
              }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/route");
    const response = await route.GET(
      makeRequest("http://localhost/api/platform/calendar/events/booking-abc", "GET"),
      { params: Promise.resolve({ bookingId: "booking-abc" }) },
    );
    const body = await response.json();
    expect(body.exists).toBe(true);
    expect(body.status).toBe("confirmed");
  });

  it("GET: accepts the CRM providerReference appointment id", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    const providerReference = "33333333-3333-4333-8333-333333333333";
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: providerReference, external_id: "booking-abc", status: "scheduled" },
        error: null,
      });
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => makeAppointmentSelectQuery(maybeSingle),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/route");
    const response = await route.GET(
      makeRequest(`http://localhost/api/platform/calendar/events/${providerReference}`, "GET"),
      { params: Promise.resolve({ bookingId: providerReference }) },
    );
    const body = await response.json();
    expect(body.exists).toBe(true);
    expect(body.status).toBe("confirmed");
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("GET: returns exists=false when no row matches", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: () => ({
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
            }),
          }),
        }),
      }),
    }));
    const route = await import("@/app/api/platform/calendar/events/[bookingId]/route");
    const response = await route.GET(
      makeRequest("http://localhost/api/platform/calendar/events/unknown", "GET"),
      { params: Promise.resolve({ bookingId: "unknown" }) },
    );
    const body = await response.json();
    expect(body.exists).toBe(false);
    expect(body.status).toBeNull();
  });
});

describe("auth — every route rejects bad signatures", () => {
  it("returns 401 when the signature doesn't match the body", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ platformSharedSecret: SECRET }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({ createCrmServiceRoleClient: () => ({}) }));
    const route = await import("@/app/api/platform/calendar/check-availability/route");
    const req = makeRequest(
      "http://localhost/api/platform/calendar/check-availability",
      "POST",
      { resourceRef: "x", startTime: "2026-05-18T08:00:00.000Z", endTime: "2026-05-18T09:00:00.000Z" },
      { signatureOverride: "sha256=deadbeef" },
    );
    const response = await route.POST(req);
    expect(response.status).toBe(401);
  });
});
