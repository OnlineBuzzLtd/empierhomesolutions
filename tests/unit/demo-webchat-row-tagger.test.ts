import { describe, expect, it, vi } from "vitest";
import { tagDemoWebchatRows } from "@/modules/crm/demo-console/server/webchat-row-tagger";

type Row = Record<string, unknown>;

class MockQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private updatePayload: Row | null = null;
  private limitValue: number | null = null;

  constructor(
    private readonly table: string,
    private readonly rows: Record<string, Row[]>,
    private readonly updates: Array<{ table: string; payload: Row; ids: string[] }>,
  ) {}

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  gte(key: string, value: unknown) {
    this.filters.push((row) => String(row[key] ?? "") >= String(value));
    return this;
  }

  in(key: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[key]));
    if (key === "id" && this.updatePayload) {
      this.updates.push({ table: this.table, payload: this.updatePayload, ids: values as string[] });
      for (const row of this.rows[this.table] ?? []) {
        if (values.includes(row.id)) Object.assign(row, this.updatePayload);
      }
    }
    return this;
  }

  order() {
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  maybeSingle() {
    const [row] = this.apply();
    return Promise.resolve({ data: row ?? null, error: null });
  }

  update(payload: Row) {
    this.updatePayload = payload;
    return this;
  }

  private apply() {
    let result = [...(this.rows[this.table] ?? [])].filter((row) => this.filters.every((filter) => filter(row)));
    if (this.limitValue !== null) result = result.slice(0, this.limitValue);
    return result;
  }

  then(resolve: (value: { data: Row[]; error: null }) => void) {
    resolve({ data: this.apply(), error: null });
  }
}

function createSupabase(rows: Record<string, Row[]>) {
  const updates: Array<{ table: string; payload: Row; ids: string[] }> = [];
  return {
    rows,
    updates,
    client: {
      schema: vi.fn().mockReturnValue({
        from: vi.fn((table: string) => new MockQuery(table, rows, updates)),
      }),
    },
  };
}

describe("tagDemoWebchatRows", () => {
  it("tags only the active session customer trail and linked commercial rows", async () => {
    const tenantId = "tenant-1";
    const rows = createSupabase({
      customers: [
        { id: "cust-1", tenant_id: tenantId, full_name: "Shaz Iqbal", phone: "+447779305853", created_at: "2026-06-01T10:01:00.000Z" },
        { id: "cust-2", tenant_id: tenantId, full_name: "Other", phone: "+447700000000", created_at: "2026-06-01T10:02:00.000Z" },
      ],
      leads: [
        { id: "lead-1", tenant_id: tenantId, customer_id: "cust-1", created_at: "2026-06-01T10:03:00.000Z" },
        { id: "lead-2", tenant_id: tenantId, customer_id: "cust-2", created_at: "2026-06-01T10:03:00.000Z" },
      ],
      jobs: [{ id: "job-1", tenant_id: tenantId, customer_id: "cust-1", lead_id: "lead-1", created_at: "2026-06-01T10:04:00.000Z" }],
      appointments: [{ id: "appt-1", tenant_id: tenantId, customer_id: "cust-1", job_id: "job-1", created_at: "2026-06-01T10:05:00.000Z" }],
      job_survey_assessments: [{ id: "survey-1", tenant_id: tenantId, job_id: "job-1", created_at: "2026-06-01T10:06:00.000Z" }],
      quotes: [{ id: "quote-1", tenant_id: tenantId, customer_id: "cust-1", job_id: "job-1", created_at: "2026-06-01T10:07:00.000Z" }],
      quote_versions: [{ id: "qv-1", tenant_id: tenantId, quote_id: "quote-1", created_at: "2026-06-01T10:08:00.000Z" }],
      quote_acceptances: [{ id: "qa-1", tenant_id: tenantId, quote_id: "quote-1", created_at: "2026-06-01T10:09:00.000Z" }],
      invoice_schedules: [{ id: "sched-1", tenant_id: tenantId, quote_id: "quote-1", created_at: "2026-06-01T10:10:00.000Z" }],
      invoices: [{ id: "inv-1", tenant_id: tenantId, customer_id: "cust-1", job_id: "job-1", quote_id: "quote-1", created_at: "2026-06-01T10:11:00.000Z" }],
      payments: [{ id: "pay-1", tenant_id: tenantId, customer_id: "cust-1", invoice_id: "inv-1", quote_id: "quote-1", created_at: "2026-06-01T10:12:00.000Z" }],
    });

    const result = await tagDemoWebchatRows({
      supabase: rows.client as never,
      tenantId,
      session: {
        id: "session-1",
        tenant_id: tenantId,
        started_at: "2026-06-01T10:00:00.000Z",
        ended_at: null,
        prospect_name: "Shaz Iqbal",
        prospect_phone: "07779 305853",
      },
      scenarioKey: "fixed_price_service_quote",
    });

    expect(result.counts.customers).toBe(1);
    expect(result.counts.leads).toBe(1);
    expect(result.counts.jobs).toBe(1);
    expect(result.counts.invoice_schedules).toBe(1);
    expect(rows.rows.customers.find((row) => row.id === "cust-1")).toMatchObject({
      is_test: true,
      is_demo: true,
      demo_scenario_key: "fixed_price_service_quote",
    });
    expect(rows.rows.customers.find((row) => row.id === "cust-2")?.is_test).toBeUndefined();
    expect(rows.rows.invoice_schedules[0]).toMatchObject({ is_test: true });
  });

  it("uses the platform conversation link to avoid broad session scans after the link exists", async () => {
    const tenantId = "tenant-1";
    const rows = createSupabase({
      platform_conversation_links: [
        {
          tenant_id: tenantId,
          conversation_id: "aaaaaaaa-1111-4111-8111-111111111111",
          customer_id: "cust-1",
          lead_id: "lead-1",
          job_id: "job-1",
          booking_appointment_id: "appt-1",
          identity_phone: "+447779305853",
        },
      ],
      customers: [
        { id: "cust-1", tenant_id: tenantId, full_name: "Linked Customer", phone: "+447700000000", created_at: "2026-06-01T10:01:00.000Z" },
      ],
      leads: [
        { id: "lead-1", tenant_id: tenantId, customer_id: "cust-1", created_at: "2026-06-01T10:03:00.000Z" },
      ],
      jobs: [{ id: "job-1", tenant_id: tenantId, customer_id: "cust-1", lead_id: "lead-1", created_at: "2026-06-01T10:04:00.000Z" }],
      appointments: [{ id: "appt-1", tenant_id: tenantId, customer_id: "cust-1", job_id: "job-1", created_at: "2026-06-01T10:05:00.000Z" }],
      job_survey_assessments: [],
      quotes: [],
      quote_versions: [],
      quote_acceptances: [],
      invoice_schedules: [],
      invoices: [],
      payments: [],
    });

    const result = await tagDemoWebchatRows({
      supabase: rows.client as never,
      tenantId,
      session: {
        id: "session-1",
        tenant_id: tenantId,
        started_at: "2026-06-01T10:00:00.000Z",
        ended_at: null,
        prospect_name: "Shaz Iqbal",
        prospect_phone: "07779 305853",
      },
      scenarioKey: "emergency_repair_booking",
      conversationId: "aaaaaaaa-1111-4111-8111-111111111111",
    });

    expect(result.matchedCustomerIds).toEqual(["cust-1"]);
    expect(result.matchedLeadIds).toEqual(["lead-1"]);
    expect(result.matchedJobIds).toEqual(["job-1"]);
    expect(rows.rows.customers[0]).toMatchObject({
      is_test: true,
      is_demo: true,
      demo_scenario_key: "emergency_repair_booking",
    });
  });
});
