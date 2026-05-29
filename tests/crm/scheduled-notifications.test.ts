import { beforeEach, describe, expect, it, vi } from "vitest";

function createUpdateChain(result: { error: unknown }) {
  const chain = {
    eq: vi.fn(() => chain),
    then: (resolve: (value: { error: unknown }) => unknown) => Promise.resolve(resolve(result)),
  };
  return chain;
}

describe("scheduled notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("dispatches due SMS rows and marks them sent", async () => {
    vi.doMock("@/modules/crm/notifications/opt-outs", () => ({
      isContactOptedOut: vi.fn().mockResolvedValue(false),
    }));
    const row = {
      id: "notification-1",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      recipient: "+447700900111",
      channel: "sms",
      template_key: "reminder_24h_sms",
      payload: { body: "Reminder text" },
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      dispatch_at: "2026-05-26T12:00:00.000Z",
      next_attempt_at: null,
      is_test: false,
    };
    const sendSms = vi.fn().mockResolvedValue({ ok: true });
    const update = vi.fn(() => createUpdateChain({ error: null }));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: [row], error: null }),
      update,
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => query),
      })),
    } as never;

    const { dispatchDueNotifications } = await import("@/modules/crm/notifications/scheduler");
    const result = await dispatchDueNotifications(supabase, {
      now: new Date("2026-05-26T12:05:00.000Z"),
      senders: { sendSms },
    });

    expect(result).toMatchObject({ selected: 1, sent: 1, failed: 0, cancelled: 0 });
    expect(sendSms).toHaveBeenCalledWith({
      to: "+447700900111",
      body: "Reminder text",
      messagingServiceSid: null,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        attempts: 1,
        sent_at: "2026-05-26T12:05:00.000Z",
      }),
    );
  });

  it("cancels test rows instead of sending real outbound by default", async () => {
    vi.doMock("@/modules/crm/notifications/opt-outs", () => ({
      isContactOptedOut: vi.fn().mockResolvedValue(false),
    }));
    const row = {
      id: "notification-2",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      recipient: "+447700900111",
      channel: "sms",
      template_key: "reminder_24h_sms",
      payload: { body: "Reminder text" },
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      dispatch_at: "2026-05-26T12:00:00.000Z",
      next_attempt_at: null,
      is_test: true,
    };
    const sendSms = vi.fn();
    const update = vi.fn(() => createUpdateChain({ error: null }));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: [row], error: null }),
      update,
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => query),
      })),
    } as never;

    const { dispatchDueNotifications } = await import("@/modules/crm/notifications/scheduler");
    const result = await dispatchDueNotifications(supabase, {
      now: new Date("2026-05-26T12:05:00.000Z"),
      senders: { sendSms },
    });

    expect(result).toMatchObject({ selected: 1, sent: 0, cancelled: 1 });
    expect(sendSms).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        last_error: "Test notification skipped by dispatcher.",
      }),
    );
  });

  it("backs off failed notifications and marks terminal failures", async () => {
    vi.doMock("@/modules/crm/notifications/opt-outs", () => ({
      isContactOptedOut: vi.fn().mockResolvedValue(false),
    }));
    const row = {
      id: "notification-3",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      recipient: "+447700900111",
      channel: "sms",
      template_key: "reminder_24h_sms",
      payload: { body: "Reminder text" },
      status: "pending",
      attempts: 2,
      max_attempts: 3,
      dispatch_at: "2026-05-26T12:00:00.000Z",
      next_attempt_at: null,
      is_test: false,
    };
    const sendSms = vi.fn().mockResolvedValue({ ok: false, warning: "carrier error" });
    const update = vi.fn(() => createUpdateChain({ error: null }));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: [row], error: null }),
      update,
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => query),
      })),
    } as never;

    const { dispatchDueNotifications } = await import("@/modules/crm/notifications/scheduler");
    const result = await dispatchDueNotifications(supabase, {
      now: new Date("2026-05-26T12:05:00.000Z"),
      senders: { sendSms },
    });

    expect(result).toMatchObject({ selected: 1, sent: 0, failed: 1 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        attempts: 3,
        last_error: "carrier error",
      }),
    );
  });

  it("cancels opted-out recipients before sending", async () => {
    vi.doMock("@/modules/crm/notifications/opt-outs", () => ({
      isContactOptedOut: vi.fn().mockResolvedValue(true),
    }));
    const row = {
      id: "notification-4",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      recipient: "+447700900111",
      channel: "sms",
      template_key: "reminder_24h_sms",
      payload: { body: "Reminder text" },
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      dispatch_at: "2026-05-26T12:00:00.000Z",
      next_attempt_at: null,
      is_test: false,
    };
    const sendSms = vi.fn();
    const update = vi.fn(() => createUpdateChain({ error: null }));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: [row], error: null }),
      update,
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => query),
      })),
    } as never;

    const { dispatchDueNotifications } = await import("@/modules/crm/notifications/scheduler");
    const result = await dispatchDueNotifications(supabase, {
      now: new Date("2026-05-26T12:05:00.000Z"),
      senders: { sendSms },
    });

    expect(result).toMatchObject({ selected: 1, sent: 0, cancelled: 1 });
    expect(sendSms).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        last_error: "Recipient has opted out of this channel.",
      }),
    );
  });
});
