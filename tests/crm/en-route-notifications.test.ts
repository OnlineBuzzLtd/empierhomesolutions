import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

describe("engineer en-route notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("queues and immediately dispatches a tenant-scoped en-route SMS", async () => {
    const job = {
      id: "job-1",
      tenant_id: "tenant-1",
      title: "Boiler repair",
      status: "booked",
      is_test: false,
      customer: { id: "customer-1", full_name: "Aisha Khan", phone: "+447700900111", postcode: "SW1A 1AA" },
      site_contact: null,
      site: { address_line1: "10 Example Street", city: "London", postcode: "SW1A 1AA" },
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: job, error: null });
    const jobEq = vi.fn(() => ({ eq: jobEq, maybeSingle }));
    const jobSelect = vi.fn(() => ({ eq: jobEq }));

    const recentLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const recentQuery = {
      select: vi.fn(() => recentQuery),
      eq: vi.fn(() => recentQuery),
      in: vi.fn(() => recentQuery),
      gte: vi.fn(() => recentQuery),
      limit: recentLimit,
    };

    const insertNote = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "jobs") {
        return { select: jobSelect };
      }
      if (table === "scheduled_notifications") {
        return recentQuery;
      }
      if (table === "notes") {
        return { insert: insertNote };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };

    const scheduleNotification = vi.fn().mockResolvedValue({ id: "notification-1" });
    const dispatchDueNotifications = vi.fn().mockResolvedValue({
      selected: 1,
      sent: 1,
      failed: 0,
      cancelled: 0,
      retried: 0,
    });

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
    }));
    vi.doMock("@/modules/crm/notifications/render", () => ({
      renderNotificationTemplate: vi.fn().mockResolvedValue({
        template: { key: "en_route_sms" },
        body: "Empire is on the way.",
      }),
    }));
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({
      scheduleNotification,
      dispatchDueNotifications,
    }));

    const route = await import("@/app/api/crm/jobs/[id]/en-route/route");
    const response = (await route.POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "job-1" }),
    })) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(scheduleNotification).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenantId: "tenant-1",
        recipient: "+447700900111",
        channel: "sms",
        templateKey: "en_route_sms",
        payload: { body: "Empire is on the way." },
        metadata: expect.objectContaining({ job_id: "job-1", notification_type: "en_route" }),
      }),
    );
    expect(dispatchDueNotifications).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ onlyId: "notification-1", limit: 1 }),
    );
    expect(insertNote).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        entity_type: "job",
        entity_id: "job-1",
        body: "En-route SMS sent to customer.",
      }),
    );
  });
});
