import { beforeEach, describe, expect, it, vi } from "vitest";

function createThenable<T>(result: T) {
  return {
    then: (resolve: (value: T) => unknown) => Promise.resolve(resolve(result)),
  };
}

describe("quote chase notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://crm.example.test";
  });

  it("schedules the three quote chase steps and mints a public quote link", async () => {
    const quote = {
      id: "quote-1",
      tenant_id: "tenant-1",
      quote_number: "Q-1001",
      status: "sent",
      total: 480,
      public_token: null,
      public_token_expires_at: null,
      is_demo: false,
      customer: { id: "customer-1", full_name: "Aisha Khan", phone: "+447700900111" },
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: quote, error: null });
    const selectEq = vi.fn(() => ({ eq: selectEq, maybeSingle }));
    const updateEq = vi.fn(() => ({ eq: updateEq, ...createThenable({ error: null }) }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq: selectEq })),
      update,
    }));
    const supabase = { schema: vi.fn(() => ({ from })) } as never;

    const scheduleNotification = vi.fn().mockResolvedValue({ id: "scheduled-1" });
    const cancelScheduledNotifications = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({
      scheduleNotification,
      cancelScheduledNotifications,
    }));
    vi.doMock("@/modules/crm/notifications/render", () => ({
      renderNotificationTemplate: vi.fn(async (_supabase, input: { key: string }) => ({
        template: { key: input.key },
        body: `${input.key} body`,
      })),
    }));

    const { scheduleQuoteChaseSequence } = await import("@/modules/crm/notifications/quote-chase");
    const result = await scheduleQuoteChaseSequence(supabase, {
      tenantId: "tenant-1",
      quoteId: "quote-1",
      sentAt: new Date("2026-05-26T12:00:00.000Z"),
    });

    expect(result).toEqual({ scheduled: 3, skipped: null });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        public_token: expect.any(String),
        public_token_expires_at: expect.any(String),
      }),
    );
    expect(cancelScheduledNotifications).toHaveBeenCalledWith(supabase, {
      tenantId: "tenant-1",
      metadataMatch: { sequence: "quote_chase", quote_id: "quote-1" },
    });
    expect(scheduleNotification).toHaveBeenCalledTimes(3);
    expect(scheduleNotification).toHaveBeenNthCalledWith(
      1,
      supabase,
      expect.objectContaining({
        tenantId: "tenant-1",
        recipient: "+447700900111",
        templateKey: "quote_chase_3d",
        dispatchAt: new Date("2026-05-29T12:00:00.000Z"),
        idempotencyKey: "quote:quote-1:chase:quote_chase_3d",
      }),
    );
  });
});
