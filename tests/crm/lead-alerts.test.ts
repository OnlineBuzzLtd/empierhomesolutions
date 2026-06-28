import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLeadAlertSmsBody,
  normalizeUkSmsRecipient,
  sendWebsiteLeadAlertSms,
} from "@/modules/crm/notifications/lead-alerts";

const ORIGINAL_ENV = process.env;

function makeSupabaseMock(options: { reserveDuplicate?: boolean } = {}) {
  const insertPayloads: unknown[] = [];
  const updatePayloads: unknown[] = [];

  const from = vi.fn((table: string) => {
    if (table !== "scheduled_notifications") {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      insert: vi.fn((payload: unknown) => {
        insertPayloads.push(payload);
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () =>
              options.reserveDuplicate
                ? { data: null, error: { code: "23505", message: "duplicate key" } }
                : { data: { id: "notification-1" }, error: null },
            ),
          })),
        };
      }),
      update: vi.fn((payload: unknown) => {
        updatePayloads.push(payload);
        return {
          eq: vi.fn(async () => ({ error: null })),
        };
      }),
    };
  });

  return {
    supabase: {
      schema: vi.fn((schema: string) => {
        if (schema !== "crm") {
          throw new Error(`Unexpected schema ${schema}`);
        }
        return { from };
      }),
    },
    insertPayloads,
    updatePayloads,
  };
}

describe("lead alert SMS", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CRM_LEAD_ALERT_SMS_TO: "07792 754 234",
      NEXT_PUBLIC_SITE_URL: "https://empire-home-solutions.vercel.app",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.clearAllMocks();
  });

  it("normalizes UK mobile recipients to E.164", () => {
    expect(normalizeUkSmsRecipient("07792 754 234")).toBe("+447792754234");
    expect(normalizeUkSmsRecipient("447792754234")).toBe("+447792754234");
    expect(normalizeUkSmsRecipient("+44 7792 754234")).toBe("+447792754234");
  });

  it("formats useful website and AI lead details", () => {
    expect(
      buildLeadAlertSmsBody({
        sourceLabel: "website lead form",
        name: "Jane Smith",
        phone: "07911 123456",
        postcode: "UB8 1AA",
        service: "boiler-repair / Uxbridge / repair",
        issue: "No heating and error code.",
        leadId: "lead-123",
      }),
    ).toContain("Empire website lead form\nName: Jane Smith\nPhone: 07911 123456");

    expect(
      buildLeadAlertSmsBody({
        sourceLabel: "AI agent booking confirmed",
        name: "Jane Smith",
        phone: "07911 123456",
        bookingTime: "22 Jun 2026, 14:30",
        conversationId: "conversation-123",
      }),
    ).toContain("Booking: 22 Jun 2026, 14:30");
  });

  it("reserves an idempotent row then sends the website lead alert", async () => {
    const { supabase, insertPayloads, updatePayloads } = makeSupabaseMock();
    const sendSms = vi.fn(async () => ({ ok: true as const }));

    const result = await sendWebsiteLeadAlertSms(
      supabase as never,
      {
        tenantId: "tenant-1",
        leadId: "lead-1",
        customerId: "customer-1",
        name: "Jane Smith",
        phone: "07911 123456",
        postcode: "UB8 1AA",
        service: "boiler-repair",
        issue: "No heating.",
        leadType: "repair",
        location: "Uxbridge",
        submissionCount: 1,
      },
      sendSms,
    );

    expect(result).toEqual({ ok: true });
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+447792754234",
        body: expect.stringContaining("Empire website lead form"),
      }),
    );
    expect(insertPayloads[0]).toEqual(
      expect.objectContaining({
        idempotency_key: "website-lead:lead-1:1",
        recipient: "+447792754234",
        status: "pending",
      }),
    );
    expect(updatePayloads[0]).toEqual(expect.objectContaining({ status: "sent", attempts: 1 }));
  });

  it("does not send a duplicate alert when the idempotency row already exists", async () => {
    const { supabase } = makeSupabaseMock({ reserveDuplicate: true });
    const sendSms = vi.fn(async () => ({ ok: true as const }));

    const result = await sendWebsiteLeadAlertSms(
      supabase as never,
      {
        tenantId: "tenant-1",
        leadId: "lead-1",
        customerId: "customer-1",
        name: "Jane Smith",
        phone: "07911 123456",
        postcode: "UB8 1AA",
        submissionCount: 1,
      },
      sendSms,
    );

    expect(result).toEqual({ ok: true, skipped: true, reason: "duplicate" });
    expect(sendSms).not.toHaveBeenCalled();
  });
});
