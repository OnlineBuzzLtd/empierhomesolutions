import { beforeEach, describe, expect, it, vi } from "vitest";

function thenable<T>(result: T) {
  return {
    then: (resolve: (value: T) => unknown) => Promise.resolve(resolve(result)),
  };
}

describe("CRM chase sequences", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://crm.example.test";
    process.env.CRM_BILLING_CONTACT_EMAIL = "billing@example.test";
  });

  it("schedules all overdue invoice chase steps", async () => {
    const invoice = {
      id: "invoice-1",
      tenant_id: "tenant-1",
      customer_id: "customer-1",
      invoice_number: "INV-1001",
      status: "unpaid",
      due_date: "2026-05-26",
      is_demo: false,
      customer: { id: "customer-1", full_name: "Aisha Khan", email: "aisha@example.test" },
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: invoice, error: null });
    const eq = vi.fn(() => ({ eq, maybeSingle }));
    const from = vi.fn((table: string) => {
      if (table !== "invoices") throw new Error(`Unexpected table ${table}`);
      return { select: vi.fn(() => ({ eq })) };
    });
    const supabase = { schema: vi.fn(() => ({ from })) } as never;

    const scheduleNotification = vi.fn().mockResolvedValue({ id: "scheduled-1" });
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({
      scheduleNotification,
      cancelScheduledNotifications: vi.fn(),
    }));
    vi.doMock("@/modules/crm/notifications/render", () => ({
      renderNotificationTemplate: vi.fn(async (_supabase, input: { key: string }) => ({
        template: { key: input.key },
        subject: `${input.key} subject`,
        body: `${input.key} body`,
      })),
    }));

    const { scheduleInvoiceChaseSequence } = await import("@/modules/crm/notifications/invoice-chase");
    const result = await scheduleInvoiceChaseSequence(supabase, {
      tenantId: "tenant-1",
      invoiceId: "invoice-1",
    });

    expect(result).toEqual({ scheduled: 4, skipped: null });
    expect(scheduleNotification).toHaveBeenCalledTimes(4);
    expect(scheduleNotification).toHaveBeenNthCalledWith(
      1,
      supabase,
      expect.objectContaining({
        tenantId: "tenant-1",
        recipient: "aisha@example.test",
        channel: "email",
        templateKey: "invoice_overdue_0d",
        dispatchAt: new Date("2026-05-26T09:00:00.000Z"),
        metadata: expect.objectContaining({ sequence: "invoice_chase", invoice_id: "invoice-1" }),
      }),
    );
    expect(scheduleNotification).toHaveBeenNthCalledWith(
      4,
      supabase,
      expect.objectContaining({
        templateKey: "invoice_overdue_21d_final",
        dispatchAt: new Date("2026-06-16T09:00:00.000Z"),
      }),
    );
  });

  it("schedules due lead chases and clears next_action_at", async () => {
    const lead = {
      id: "lead-1",
      tenant_id: "tenant-1",
      status: "new",
      next_action_at: "2026-05-26T12:00:00.000Z",
      is_demo: false,
      customer: { id: "customer-1", full_name: "Aisha Khan", phone: "+447700900111" },
      service: { name: "Boiler repair" },
    };

    const dueLimit = vi.fn().mockResolvedValue({ data: [{ id: "lead-1", tenant_id: "tenant-1" }], error: null });
    const dueQuery = {
      select: vi.fn(() => dueQuery),
      in: vi.fn(() => dueQuery),
      not: vi.fn(() => dueQuery),
      lte: vi.fn(() => dueQuery),
      order: vi.fn(() => dueQuery),
      limit: dueLimit,
    };
    const leadMaybeSingle = vi.fn().mockResolvedValue({ data: lead, error: null });
    const leadEq = vi.fn(() => ({ eq: leadEq, maybeSingle: leadMaybeSingle }));
    const appointmentLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const appointmentQuery = {
      select: vi.fn(() => appointmentQuery),
      eq: vi.fn(() => appointmentQuery),
      neq: vi.fn(() => appointmentQuery),
      limit: appointmentLimit,
    };
    const updateEq = vi.fn(() => ({ eq: updateEq, ...thenable({ error: null }) }));
    const update = vi.fn(() => ({ eq: updateEq }));
    let leadsSelectCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "leads") {
        return {
          select: vi.fn(() => {
            leadsSelectCount += 1;
            return leadsSelectCount === 1 ? dueQuery : { eq: leadEq };
          }),
          update,
        };
      }
      if (table === "appointments") return appointmentQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) } as never;

    const scheduleNotification = vi.fn().mockResolvedValue({ id: "scheduled-1" });
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({ scheduleNotification }));
    vi.doMock("@/modules/crm/notifications/render", () => ({
      renderNotificationTemplate: vi.fn(async (_supabase, input: { key: string }) => ({
        template: { key: input.key },
        body: `${input.key} body`,
      })),
    }));

    const { scheduleDueLeadChases } = await import("@/modules/crm/notifications/lead-chase");
    const result = await scheduleDueLeadChases(supabase, {
      now: new Date("2026-05-26T12:00:00.000Z"),
    });

    expect(result).toEqual({ leads: 1, scheduled: 2, skipped: 0 });
    expect(scheduleNotification).toHaveBeenCalledTimes(2);
    expect(scheduleNotification).toHaveBeenNthCalledWith(
      1,
      supabase,
      expect.objectContaining({
        templateKey: "lead_chase_24h",
        dispatchAt: new Date("2026-05-26T12:00:00.000Z"),
      }),
    );
    expect(update).toHaveBeenCalledWith({ next_action_at: null });
  });

  it("schedules 90-day lost lead re-engagements and marks the lead", async () => {
    const lead = {
      id: "lead-lost",
      tenant_id: "tenant-1",
      created_at: "2026-01-01T00:00:00.000Z",
      is_demo: false,
      customer: { id: "customer-1", full_name: "Aisha Khan", phone: "+447700900111" },
      service: { name: "Boiler repair" },
      tenant: { name: "Empire" },
    };

    const leadLimit = vi.fn().mockResolvedValue({ data: [lead], error: null });
    const leadQuery = {
      select: vi.fn(() => leadQuery),
      eq: vi.fn(() => leadQuery),
      is: vi.fn(() => leadQuery),
      lte: vi.fn(() => leadQuery),
      order: vi.fn(() => leadQuery),
      limit: leadLimit,
    };
    const settingsMaybeSingle = vi.fn().mockResolvedValue({
      data: { lost_lead_reengagement_enabled: true },
      error: null,
    });
    const settingsEq = vi.fn(() => ({ maybeSingle: settingsMaybeSingle }));
    const updateEq = vi.fn(() => ({ eq: updateEq, ...thenable({ error: null }) }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const from = vi.fn((table: string) => {
      if (table === "leads") return { ...leadQuery, update };
      if (table === "tenant_settings") return { select: vi.fn(() => ({ eq: settingsEq })) };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) } as never;

    const scheduleNotification = vi.fn().mockResolvedValue({ id: "scheduled-1" });
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({ scheduleNotification }));
    vi.doMock("@/modules/crm/notifications/render", () => ({
      renderNotificationTemplate: vi.fn().mockResolvedValue({
        template: { key: "lost_lead_reengage_90d" },
        body: "Still need help?",
      }),
    }));

    const { scheduleDueLostLeadReengagements } = await import(
      "@/modules/crm/notifications/lost-lead-reengagement"
    );
    const result = await scheduleDueLostLeadReengagements(supabase, {
      now: new Date("2026-05-26T12:00:00.000Z"),
    });

    expect(result).toEqual({ leads: 1, scheduled: 1, skipped: 0 });
    expect(scheduleNotification).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenantId: "tenant-1",
        recipient: "+447700900111",
        templateKey: "lost_lead_reengage_90d",
        dispatchAt: new Date("2026-05-26T12:00:00.000Z"),
      }),
    );
    expect(update).toHaveBeenCalledWith({ re_engaged_at: "2026-05-26T12:00:00.000Z" });
  });
});
