import { beforeEach, describe, expect, it, vi } from "vitest";

function createThenable<T>(result: T) {
  const chain = {
    eq: vi.fn(() => chain),
    then: (resolve: (value: T) => unknown) => Promise.resolve(resolve(result)),
  };
  return chain;
}

describe("cron foundation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("authenticates with bearer or x-cron-secret", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ cronSecret: "cron-secret" }),
    }));

    const { authenticateCronRequest } = await import("@/modules/crm/lib/cron-auth");

    expect(
      authenticateCronRequest(
        new Request("http://localhost/api/_cron/dispatch", {
          headers: { authorization: "Bearer cron-secret" },
        }),
      ).ok,
    ).toBe(true);
    expect(
      authenticateCronRequest(
        new Request("http://localhost/api/_cron/dispatch", {
          headers: { "x-cron-secret": "cron-secret" },
        }),
      ).ok,
    ).toBe(true);
    expect(authenticateCronRequest(new Request("http://localhost/api/_cron/dispatch")).status).toBe(401);
  });

  it("runs a registered cron job once per cadence window", async () => {
    vi.doMock("@/modules/crm/notifications/scheduler", () => ({
      dispatchDueNotifications: vi.fn().mockResolvedValue({ sent: 0 }),
    }));
    const cron = await import("@/modules/crm/lib/cron-registry");
    cron.clearCronJobsForTests();

    const run = vi.fn().mockResolvedValue({ ok: true });
    cron.registerCronJob({ name: "sample", cadenceMinutes: 5, run });

    const insertSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "log-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key" } });
    const insert = vi.fn(() => ({ select: () => ({ single: insertSingle }) }));
    const update = vi.fn(() => createThenable({ error: null }));
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => ({ insert, update })),
      })),
    } as never;

    const now = new Date("2026-05-26T12:03:00.000Z");
    const first = await cron.runDueCronJobs(supabase, { now });
    const second = await cron.runDueCronJobs(supabase, { now });

    expect(run).toHaveBeenCalledTimes(1);
    expect(first.results[0]).toMatchObject({ job: "sample", status: "succeeded" });
    expect(second.results[0]).toMatchObject({ job: "sample", status: "skipped" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        job_name: "sample",
        window_start: "2026-05-26T12:00:00.000Z",
        idempotency_key: "cron:global:sample:2026-05-26T12:00:00.000Z",
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        result: { ok: true },
      }),
    );
  });

  it("dispatch route rejects unauthorized requests", async () => {
    vi.doMock("@/modules/crm/lib/env", () => ({
      getCrmEnv: vi.fn().mockReturnValue({ cronSecret: "cron-secret" }),
    }));
    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServiceRoleClient: vi.fn(),
    }));

    const route = await import("@/app/api/_cron/dispatch/route");
    const response = await route.GET(new Request("http://localhost/api/_cron/dispatch"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized.");
  });
});
