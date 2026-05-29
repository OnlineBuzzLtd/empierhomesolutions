import { beforeEach, describe, expect, it, vi } from "vitest";

function thenable<T>(result: T) {
  return {
    then: (resolve: (value: T) => unknown) => Promise.resolve(resolve(result)),
  };
}

describe("review request and feedback flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FEEDBACK_TOKEN_SECRET = "test-feedback-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://crm.example.test";
  });

  it("schedules SMS and email review requests for a completed job", async () => {
    const existingLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const existingQuery = {
      select: vi.fn(() => existingQuery),
      eq: vi.fn(() => existingQuery),
      limit: existingLimit,
    };
    const requestSingle = vi.fn().mockResolvedValue({ data: { id: "request-1" }, error: null });
    const requestInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: requestSingle })) }));

    const settingsMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        review_requests_enabled: true,
        review_primary_platform: "google",
        review_google_place_id: "google-place-1",
        review_trustpilot_url: null,
        review_facebook_url: null,
      },
      error: null,
    });
    const settingsEq = vi.fn(() => ({ maybeSingle: settingsMaybeSingle }));

    const jobMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "job-1",
        tenant_id: "tenant-1",
        customer_id: "customer-1",
        title: "Boiler repair",
        is_demo: false,
        customer: {
          id: "customer-1",
          full_name: "Aisha Khan",
          phone: "+447700900111",
          email: "aisha@example.test",
        },
      },
      error: null,
    });
    const jobEq = vi.fn(() => ({ eq: jobEq, maybeSingle: jobMaybeSingle }));

    const from = vi.fn((table: string) => {
      if (table === "feedback_requests") {
        return { select: existingQuery.select, insert: requestInsert };
      }
      if (table === "tenant_settings") {
        return { select: vi.fn(() => ({ eq: settingsEq })) };
      }
      if (table === "jobs") {
        return { select: vi.fn(() => ({ eq: jobEq })) };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) } as never;

    const scheduleNotification = vi.fn().mockResolvedValue({ id: "scheduled-1" });
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({ scheduleNotification }));
    vi.doMock("@/modules/crm/notifications/render", () => ({
      renderNotificationTemplate: vi.fn(async (_supabase, input: { key: string; channel: string }) => ({
        template: { key: input.key },
        subject: input.channel === "email" ? "How did we do?" : null,
        body: `${input.key} body`,
      })),
    }));

    const { scheduleReviewRequestsForCompletedJob } = await import("@/modules/crm/notifications/review-requests");
    const result = await scheduleReviewRequestsForCompletedJob(supabase, {
      tenantId: "tenant-1",
      jobId: "job-1",
      completedAt: new Date("2026-05-26T12:00:00.000Z"),
    });

    expect(result).toEqual({ scheduled: 2, skipped: null });
    expect(requestInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        customer_id: "customer-1",
        job_id: "job-1",
        channel: "mixed",
        token_hash: expect.any(String),
      }),
    );
    expect(scheduleNotification).toHaveBeenCalledTimes(2);
    expect(scheduleNotification).toHaveBeenNthCalledWith(
      1,
      supabase,
      expect.objectContaining({
        channel: "sms",
        recipient: "+447700900111",
        dispatchAt: new Date("2026-05-26T14:00:00.000Z"),
      }),
    );
    expect(scheduleNotification).toHaveBeenNthCalledWith(
      2,
      supabase,
      expect.objectContaining({
        channel: "email",
        recipient: "aisha@example.test",
      }),
    );
  });

  it("records low-score feedback, flags the customer, and writes a job note", async () => {
    const { mintFeedbackToken, hashFeedbackToken } = await import("@/modules/crm/notifications/review-requests");
    const token = mintFeedbackToken();
    const requestRow = {
      id: "request-1",
      tenant_id: "tenant-1",
      customer_id: "customer-1",
      job_id: "job-1",
      expires_at: "2026-06-26T12:00:00.000Z",
      used_at: null,
    };

    const feedbackMaybeSingle = vi.fn().mockResolvedValue({ data: requestRow, error: null });
    const feedbackEq = vi.fn(() => ({ maybeSingle: feedbackMaybeSingle }));
    const feedbackSelect = vi.fn(() => ({ eq: feedbackEq }));
    const feedbackUpdateEq = vi.fn(() => ({ ...thenable({ error: null }) }));
    const feedbackUpdate = vi.fn(() => ({ eq: feedbackUpdateEq }));
    const responseInsert = vi.fn().mockResolvedValue({ error: null });
    const customerUpdateEq = vi.fn(() => ({ eq: customerUpdateEq, ...thenable({ error: null }) }));
    const customerUpdate = vi.fn(() => ({ eq: customerUpdateEq }));
    const noteInsert = vi.fn().mockResolvedValue({ error: null });

    const settingsMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const settingsEq = vi.fn(() => ({ maybeSingle: settingsMaybeSingle }));

    const from = vi.fn((table: string) => {
      if (table === "feedback_requests") {
        return { select: feedbackSelect, update: feedbackUpdate };
      }
      if (table === "tenant_settings") {
        return { select: vi.fn(() => ({ eq: settingsEq })) };
      }
      if (table === "feedback_responses") {
        return { insert: responseInsert };
      }
      if (table === "customers") {
        return { update: customerUpdate };
      }
      if (table === "notes") {
        return { insert: noteInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { schema: vi.fn(() => ({ from })) };

    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn(() => supabase),
    }));

    const route = await import("@/app/api/feedback/[token]/route");
    const body = new FormData();
    body.set("score", "2");
    body.set("comment", "Engineer did not arrive");
    const response = (await route.POST(new Request("https://crm.example.test/feedback", { method: "POST", body }), {
      params: Promise.resolve({ token }),
    })) as Response;

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://crm.example.test/feedback/thanks?status=received");
    expect(feedbackEq).toHaveBeenCalledWith("token_hash", hashFeedbackToken(token));
    expect(responseInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        request_id: "request-1",
        score: 2,
        comment: "Engineer did not arrive",
        redirect_url: null,
      }),
    );
    expect(customerUpdate).toHaveBeenCalledWith({ requires_call: true });
    expect(noteInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        entity_type: "job",
        entity_id: "job-1",
        body: "Low feedback score received: 2/5 - Engineer did not arrive",
      }),
    );
  });
});
