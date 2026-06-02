import { beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_STARTED_AT = "2026-06-01T10:00:00.000Z";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const QUOTE_ID = "44444444-4444-4444-8444-444444444444";
const INVOICE_ID = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;

class MockQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private limitValue: number | null = null;

  constructor(
    private readonly table: string,
    private readonly rows: Record<string, Row[]>,
    private readonly calls: Array<{ table: string; op: string; key?: string; value?: unknown }>,
  ) {}

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.calls.push({ table: this.table, op: "eq", key, value });
    this.filters.push((row) => row[key] === value);
    return this;
  }

  gte(key: string, value: unknown) {
    this.calls.push({ table: this.table, op: "gte", key, value });
    this.filters.push((row) => String(row[key] ?? "") >= String(value));
    return this;
  }

  in(key: string, values: unknown[]) {
    this.calls.push({ table: this.table, op: "in", key, value: values });
    this.filters.push((row) => values.includes(row[key]));
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  update(value: Row) {
    this.calls.push({ table: this.table, op: "update", value });
    return this;
  }

  private apply() {
    let result = [...(this.rows[this.table] ?? [])].filter((row) => this.filters.every((filter) => filter(row)));
    if (this.limitValue !== null) result = result.slice(0, this.limitValue);
    return result;
  }

  async maybeSingle<T>() {
    return { data: (this.apply()[0] ?? null) as T | null, error: null };
  }

  then(resolve: (value: { data: Row[]; error: null }) => void) {
    resolve({ data: this.apply(), error: null });
  }
}

function createSupabase(rows: Record<string, Row[]>) {
  const calls: Array<{ table: string; op: string; key?: string; value?: unknown }> = [];
  return {
    calls,
    schema: vi.fn().mockReturnValue({
      from: vi.fn((table: string) => new MockQuery(table, rows, calls)),
    }),
  };
}

function mockDemoGuard(admin: ReturnType<typeof createSupabase>, extra: Row = {}) {
  vi.doMock("@/modules/crm/demo-console/server/session-guard", () => ({
    guardDemoApi: vi.fn().mockResolvedValue({
      ok: true,
      tenantId: TENANT_ID,
      userId: "user-1",
      activeSession: { started_at: SESSION_STARTED_AT, id: "demo-session-1", ...extra },
      admin,
    }),
  }));
}

describe("demo quote and live-record routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("validates the live-record type before reading CRM tables", async () => {
    vi.doMock("@/modules/crm/demo-console/server/session-guard", () => ({
      guardDemoApi: vi.fn().mockResolvedValue({
        ok: true,
        tenantId: TENANT_ID,
        userId: "user-1",
        activeSession: { started_at: SESSION_STARTED_AT },
        admin: { schema: vi.fn() },
      }),
    }));

    const route = await import("@/app/api/crm/demo/live-record/route");
    const response = (await route.GET(
      new Request("http://localhost/api/crm/demo/live-record?type=platform_event&id=11111111-1111-4111-8111-111111111111"),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("returns the demo guard response when quote actions have no active session", async () => {
    vi.doMock("@/modules/crm/demo-console/server/session-guard", () => ({
      guardDemoApi: vi.fn().mockResolvedValue({
        ok: false,
        response: Response.json({ error: "No active demo session. Capture consent first." }, { status: 409 }),
      }),
    }));

    const route = await import("@/app/api/crm/demo/quote/from-job/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ action: "draft_from_service_booking" }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("No active demo session");
  });

  it("scopes live-record detail to active demo rows and returns the linked commercial trail", async () => {
    const admin = createSupabase({
      customers: [
        {
          id: CUSTOMER_ID,
          tenant_id: TENANT_ID,
          full_name: "Demo Customer",
          is_test: true,
          created_at: "2026-06-01T10:01:00.000Z",
          provider_payload: { hidden: true },
        },
      ],
      leads: [],
      jobs: [
        {
          id: JOB_ID,
          tenant_id: TENANT_ID,
          customer_id: CUSTOMER_ID,
          title: "Boiler service",
          is_test: true,
          created_at: "2026-06-01T10:02:00.000Z",
        },
      ],
      appointments: [],
      job_survey_assessments: [],
      quotes: [
        {
          id: QUOTE_ID,
          tenant_id: TENANT_ID,
          customer_id: CUSTOMER_ID,
          job_id: JOB_ID,
          quote_number: "Q-0001",
          status: "draft",
          is_test: true,
          created_at: "2026-06-01T10:03:00.000Z",
          raw_payload: { hidden: true },
        },
      ],
      quote_acceptances: [],
      invoice_schedules: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          tenant_id: TENANT_ID,
          quote_id: QUOTE_ID,
          label: "Final invoice",
          status: "planned",
          is_test: true,
          created_at: "2026-06-01T10:04:00.000Z",
        },
      ],
      invoices: [
        {
          id: INVOICE_ID,
          tenant_id: TENANT_ID,
          customer_id: CUSTOMER_ID,
          job_id: JOB_ID,
          quote_id: QUOTE_ID,
          invoice_number: "INV-0001",
          status: "unpaid",
          is_test: true,
          created_at: "2026-06-01T10:05:00.000Z",
        },
      ],
      payments: [],
    });
    mockDemoGuard(admin);

    const route = await import("@/app/api/crm/demo/live-record/route");
    const response = (await route.GET(
      new Request(`http://localhost/api/crm/demo/live-record?type=customer&id=${CUSTOMER_ID}`),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.commercial.quotes).toHaveLength(1);
    expect(body.commercial.invoice_schedules).toHaveLength(1);
    expect(body.commercial.invoices).toHaveLength(1);
    expect(body.record.provider_payload).toBeUndefined();
    expect(body.commercial.quotes[0].raw.raw_payload).toBeUndefined();
    expect(admin.calls).toEqual(
      expect.arrayContaining([
        { table: "customers", op: "eq", key: "is_test", value: true },
        { table: "quotes", op: "in", key: "job_id", value: [JOB_ID] },
        { table: "quotes", op: "eq", key: "is_test", value: true },
      ]),
    );
  });

  it("does not expose non-demo live-record rows", async () => {
    const admin = createSupabase({
      jobs: [
        {
          id: JOB_ID,
          tenant_id: TENANT_ID,
          customer_id: CUSTOMER_ID,
          title: "Real job",
          is_test: false,
          created_at: "2026-06-01T10:02:00.000Z",
        },
      ],
    });
    mockDemoGuard(admin);

    const route = await import("@/app/api/crm/demo/live-record/route");
    const response = (await route.GET(
      new Request(`http://localhost/api/crm/demo/live-record?type=job&id=${JOB_ID}`),
    )) as Response;

    expect(response.status).toBe(404);
    expect(admin.calls).toEqual(expect.arrayContaining([{ table: "jobs", op: "eq", key: "is_test", value: true }]));
  });

  it("blocks demo quote actions while the kill switch is active", async () => {
    const admin = createSupabase({
      tenant_settings: [{ tenant_id: TENANT_ID, demo_kill_switch_at: new Date().toISOString() }],
    });
    mockDemoGuard(admin);
    vi.doMock("@/modules/crm/lib/quote-automation", () => ({
      draftQuoteForJob: vi.fn(),
    }));

    const route = await import("@/app/api/crm/demo/quote/from-job/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ action: "draft_from_service_booking", job_id: JOB_ID }),
      }),
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body.error).toContain("kill switch");
  });

  it("refuses to run demo quote actions against non-test jobs", async () => {
    const draftQuoteForJob = vi.fn();
    const admin = createSupabase({
      tenant_settings: [{ tenant_id: TENANT_ID, demo_kill_switch_at: null }],
      jobs: [
        {
          id: JOB_ID,
          tenant_id: TENANT_ID,
          customer_id: CUSTOMER_ID,
          title: "Real job",
          is_test: false,
          created_at: "2026-06-01T10:02:00.000Z",
        },
      ],
    });
    mockDemoGuard(admin);
    vi.doMock("@/modules/crm/lib/quote-automation", () => ({
      draftQuoteForJob,
    }));

    const route = await import("@/app/api/crm/demo/quote/from-job/route");
    const response = (await route.POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ action: "draft_from_service_booking", job_id: JOB_ID }),
      }),
    )) as Response;

    expect(response.status).toBe(404);
    expect(draftQuoteForJob).not.toHaveBeenCalled();
    expect(admin.calls).toEqual(expect.arrayContaining([{ table: "jobs", op: "eq", key: "is_test", value: true }]));
  });
});
