import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function jsonSuccess(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data });
}

function makeSelectChain(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
    returns: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function makeInsertChain(result: unknown) {
  return {
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(result),
    })),
  };
}

describe("lead confirm booking route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates a booked job and booking appointment, then marks the enquiry booked", async () => {
    const lead = {
      id: "11111111-1111-4111-8111-111111111101",
      tenant_id: "tenant-1",
      customer_id: "11111111-1111-4111-8111-111111111201",
      possible_duplicate_customer_id: null,
      service_id: "11111111-1111-4111-8111-111111111301",
      job_type_id: "11111111-1111-4111-8111-111111111401",
      status: "new",
      notes: "Customer has a leak.",
      problem_description: "Leak under sink",
      affected_area: "Kitchen",
      urgency_level: "same_day",
      preferred_date_text: "Tomorrow",
      preferred_time_window: "AM",
      customer_match_result: "matched",
      is_test: false,
      customer: {
        id: "11111111-1111-4111-8111-111111111201",
        full_name: "Aisha Khan",
        phone: "+447700900111",
        email: "aisha@example.com",
        postcode: "SW1A 1AA",
      },
    };
    const customer = lead.customer;
    const profiles = [{ id: "11111111-1111-4111-8111-111111111501", user_id: "11111111-1111-4111-8111-111111111601", full_name: "Shane" }];
    const job = {
      id: "11111111-1111-4111-8111-111111111701",
      customer_id: customer.id,
      lead_id: lead.id,
      title: "Leak repair for Aisha Khan",
      status: "booked",
      created_at: "2026-06-01T10:00:00.000Z",
    };
    const appointment = {
      id: "11111111-1111-4111-8111-111111111801",
      starts_at: "2026-06-02T08:30:00.000Z",
      ends_at: "2026-06-02T09:30:00.000Z",
    };
    const updatedLead = { ...lead, status: "booked" };

    const insertJob = vi.fn().mockReturnValue(makeInsertChain({ data: job, error: null }));
    const insertAssignees = vi.fn().mockResolvedValue({ error: null });
    const insertAppointment = vi.fn().mockReturnValue(makeInsertChain({ data: appointment, error: null }));
    const updateLead = vi.fn().mockReturnValue({
      eq: vi.fn(function eq() {
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: updatedLead, error: null }),
            })),
          })),
        };
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => makeSelectChain({ data: lead, error: null })),
          update: updateLead,
        };
      }
      if (table === "customers") {
        return { select: vi.fn(() => makeSelectChain({ data: customer, error: null })) };
      }
      if (table === "user_profiles") {
        return { select: vi.fn(() => makeSelectChain({ data: profiles, error: null })) };
      }
      if (table === "jobs") {
        return { insert: insertJob };
      }
      if (table === "job_assignees") {
        return { insert: insertAssignees };
      }
      if (table === "appointments") {
        return { insert: insertAppointment };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => value),
      parseIdList: vi.fn((value) => (Array.isArray(value) ? value : [value].filter(Boolean))),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
      resolveCreatedByUserId: vi.fn().mockReturnValue("user-1"),
    }));
    vi.doMock("@/modules/crm/notifications/appointment-reminders", () => ({
      syncAppointmentReminder24h: vi.fn().mockResolvedValue({ scheduled: 0 }),
    }));
    vi.doMock("@/modules/crm/notifications/render", () => ({
      renderNotificationTemplate: vi.fn(),
    }));
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({
      scheduleNotification: vi.fn(),
      dispatchDueNotifications: vi.fn(),
    }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent: vi.fn().mockResolvedValue(undefined),
      publishPendingPlatformOutboxEvents: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/modules/crm/lib/quote-automation", () => ({
      draftQuoteForJob: vi.fn().mockResolvedValue({
        status: "blocked",
        quoteId: null,
        invoiceScheduleIds: [],
        blockers: [{ code: "feature_disabled", message: "Disabled in test." }],
        warnings: [],
        automationMetadata: {},
      }),
    }));

    const route = await import("@/app/api/crm/leads/[id]/confirm-booking/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customer.id,
          service_id: lead.service_id,
          job_type_id: lead.job_type_id,
          title: "Leak repair for Aisha Khan",
          scheduled_date: "2026-06-02",
          scheduled_time: "09:30",
          duration_hours: "1",
          assigned_engineer_ids: [profiles[0]!.id],
        }),
      }),
      { params: Promise.resolve({ id: lead.id }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(insertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: customer.id,
        lead_id: lead.id,
        status: "booked",
        assigned_engineer: "Shane",
      }),
    );
    expect(insertAssignees).toHaveBeenCalledWith([
      expect.objectContaining({ job_id: job.id, user_profile_id: profiles[0]!.id }),
    ]);
    expect(insertAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: customer.id,
        lead_id: lead.id,
        job_id: job.id,
        type: "booking",
        status: "scheduled",
      }),
    );
    expect(updateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "booked",
        next_action_at: null,
      }),
    );
  });

  it("returns a useful validation error when no engineer is selected", async () => {
    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => value),
      parseIdList: vi.fn(() => []),
      requireCrmApiUser: vi.fn(),
      resolveCreatedByUserId: vi.fn(),
    }));
    vi.doMock("@/modules/crm/notifications/appointment-reminders", () => ({ syncAppointmentReminder24h: vi.fn() }));
    vi.doMock("@/modules/crm/notifications/render", () => ({ renderNotificationTemplate: vi.fn() }));
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({ scheduleNotification: vi.fn(), dispatchDueNotifications: vi.fn() }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent: vi.fn(),
      publishPendingPlatformOutboxEvents: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/quote-automation", () => ({
      draftQuoteForJob: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/[id]/confirm-booking/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          customer_id: "11111111-1111-4111-8111-111111111201",
          service_id: "11111111-1111-4111-8111-111111111301",
          job_type_id: "11111111-1111-4111-8111-111111111401",
          title: "Leak repair",
          scheduled_date: "2026-06-02",
          scheduled_time: "09:30",
          duration_hours: "1",
          assigned_engineer_ids: [],
        }),
      }),
      { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111101" }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Select an engineer before confirming the booking.");
  });

  it("blocks possible duplicates until the operator confirms customer resolution", async () => {
    const lead = {
      id: "11111111-1111-4111-8111-111111111101",
      tenant_id: "tenant-1",
      customer_id: "11111111-1111-4111-8111-111111111201",
      possible_duplicate_customer_id: "11111111-1111-4111-8111-111111111202",
      service_id: "11111111-1111-4111-8111-111111111301",
      job_type_id: "11111111-1111-4111-8111-111111111401",
      status: "new",
      notes: null,
      customer_match_result: "possible_duplicate",
      is_test: false,
      customer: null,
    };
    const from = vi.fn((table: string) => {
      if (table === "leads") {
        return { select: vi.fn(() => makeSelectChain({ data: lead, error: null })) };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };

    vi.doMock("@/modules/crm/lib/api", () => ({
      jsonError,
      jsonSuccess,
      normalizeBlankFields: vi.fn((value) => value),
      parseIdList: vi.fn((value) => (Array.isArray(value) ? value : [value].filter(Boolean))),
      requireCrmApiUser: vi.fn().mockResolvedValue({
        session: { supabase, tenant: { id: "tenant-1" }, user: { id: "user-1" } },
      }),
      resolveCreatedByUserId: vi.fn(),
    }));
    vi.doMock("@/modules/crm/notifications/appointment-reminders", () => ({ syncAppointmentReminder24h: vi.fn() }));
    vi.doMock("@/modules/crm/notifications/render", () => ({ renderNotificationTemplate: vi.fn() }));
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({ scheduleNotification: vi.fn(), dispatchDueNotifications: vi.fn() }));
    vi.doMock("@/modules/platform/lib/outbox", () => ({
      enqueueCrmPlatformEvent: vi.fn(),
      publishPendingPlatformOutboxEvents: vi.fn(),
    }));
    vi.doMock("@/modules/crm/lib/quote-automation", () => ({
      draftQuoteForJob: vi.fn(),
    }));

    const route = await import("@/app/api/crm/leads/[id]/confirm-booking/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          customer_id: lead.customer_id,
          service_id: lead.service_id,
          job_type_id: lead.job_type_id,
          title: "Leak repair",
          scheduled_date: "2026-06-02",
          scheduled_time: "09:30",
          duration_hours: "1",
          assigned_engineer_ids: ["11111111-1111-4111-8111-111111111501"],
        }),
      }),
      { params: Promise.resolve({ id: lead.id }) },
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Choose the correct customer before confirming this duplicate enquiry.");
  });
});
