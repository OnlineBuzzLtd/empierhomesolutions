import { describe, expect, it } from "vitest";
import { buildDeleteTrailPlan, executeDeleteTrailPlan } from "@/modules/crm/lib/delete-trail";

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

class FakeQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];
  private orFilter: string | null = null;
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private payload: unknown;
  private singleMode: "single" | "maybe" | null = null;

  constructor(
    private db: Db,
    private table: string,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  is(column: string, value: null) {
    this.filters.push({ column, value });
    return this;
  }

  or(expression: string) {
    this.orFilter = expression;
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  returns() {
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private matches(row: Row) {
    const eqMatches = this.filters.every((filter) => row[filter.column] === filter.value);
    const inMatches = this.inFilters.every((filter) => filter.values.includes(row[filter.column]));
    const orMatches = !this.orFilter || this.orFilter.split(",").some((clause) => {
      const [column, op, ...rest] = clause.split(".");
      const value = rest.join(".");
      if (op === "eq") return String(row[column]) === value;
      if (op === "is" && value === "null") return row[column] === null || row[column] === undefined;
      return false;
    });
    return eqMatches && inMatches && orMatches;
  }

  private rows() {
    return this.db[this.table] ?? [];
  }

  private execute() {
    if (this.operation === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = rows.map((row) => ({
        id: (row as Row).id ?? `${this.table}-${this.rows().length + 1}`,
        ...(row as Row),
      }));
      this.db[this.table] = [...this.rows(), ...inserted];
      return { data: this.singleMode ? inserted[0] : inserted, error: null };
    }

    const matched = this.rows().filter((row) => this.matches(row));

    if (this.operation === "update") {
      this.db[this.table] = this.rows().map((row) => (this.matches(row) ? { ...row, ...(this.payload as Row) } : row));
      const updated = this.db[this.table].filter((row) => matched.some((item) => item.id === row.id));
      return { data: this.singleMode ? updated[0] ?? null : updated, error: null };
    }

    if (this.operation === "delete") {
      this.db[this.table] = this.rows().filter((row) => !this.matches(row));
      return { data: null, error: null };
    }

    if (this.singleMode === "maybe") {
      return { data: matched[0] ?? null, error: null };
    }
    if (this.singleMode === "single") {
      return { data: matched[0] ?? null, error: null };
    }
    return { data: matched, error: null };
  }
}

function fakeSupabase(db: Db) {
  return {
    schema: () => ({
      from: (table: string) => new FakeQuery(db, table),
    }),
    storage: {
      from: () => ({
        remove: async () => ({ data: [], error: null }),
      }),
    },
  };
}

function baseDb(): Db {
  return {
    customers: [{ id: "cust-1", tenant_id: "tenant-1", full_name: "Hannah Mercer", archived: false }],
    leads: [{ id: "lead-1", tenant_id: "tenant-1", customer_id: "cust-1", source: "webchat" }],
    jobs: [{ id: "job-1", tenant_id: "tenant-1", customer_id: "cust-1", lead_id: "lead-1", title: "Boiler repair" }],
    appointments: [{ id: "appt-1", tenant_id: "tenant-1", customer_id: "cust-1", lead_id: "lead-1", job_id: "job-1" }],
    sites: [{ id: "site-1", tenant_id: "tenant-1", customer_id: "cust-1" }],
    site_contacts: [{ id: "contact-1", tenant_id: "tenant-1", site_id: "site-1" }],
    customer_assets: [{ id: "asset-1", tenant_id: "tenant-1", customer_id: "cust-1" }],
    notes: [{ id: "note-1", tenant_id: "tenant-1", entity_type: "job", entity_id: "job-1" }],
    attachments: [{ id: "att-1", tenant_id: "tenant-1", entity_type: "customer", entity_id: "cust-1", file_url: "tenant-1/customer/file.pdf" }],
    custom_field_values: [],
    job_assignees: [{ id: "ja-1", tenant_id: "tenant-1", job_id: "job-1" }],
    job_phases: [],
    job_variations: [],
    job_hazards: [],
    job_checklists: [],
    job_certificates: [{ id: "cert-1", tenant_id: "tenant-1", job_id: "job-1", file_url: "tenant-1/job/cert.pdf" }],
    purchase_orders: [],
    supplier_reconciliation: [],
    expenses: [{ id: "exp-1", tenant_id: "tenant-1", job_id: "job-1" }],
    platform_conversation_links: [{ id: "link-1", tenant_id: "tenant-1", customer_id: "cust-1", lead_id: "lead-1", job_id: "job-1" }],
    scheduled_notifications: [{ id: "sn-1", tenant_id: "tenant-1", status: "pending", metadata: { job_id: "job-1" } }],
    quotes: [{ id: "quote-1", tenant_id: "tenant-1", customer_id: "cust-1", job_id: "job-1", line_items: [{ label: "Work" }] }],
    quote_versions: [{ id: "qv-1", tenant_id: "tenant-1", quote_id: "quote-1", line_items: [{ label: "Work" }] }],
    quote_acceptances: [{ id: "qa-1", tenant_id: "tenant-1", quote_id: "quote-1", accepted_by_name: "Hannah", accepted_by_email: "h@example.com" }],
    invoices: [{ id: "inv-1", tenant_id: "tenant-1", customer_id: "cust-1", job_id: "job-1", quote_id: "quote-1", line_items: [{ label: "Work" }] }],
    payments: [{ id: "pay-1", tenant_id: "tenant-1", customer_id: "cust-1", invoice_id: "inv-1", quote_id: "quote-1", notes: "Card" }],
    platform_event_log: [],
    deletion_requests: [],
    deletion_storage_tasks: [],
  };
}

describe("delete trail", () => {
  it("previews a customer trail with operational deletes and financial anonymisation", async () => {
    const db = baseDb();
    const plan = await buildDeleteTrailPlan({
      supabase: fakeSupabase(db),
      tenantId: "tenant-1",
      rootType: "customer",
      rootId: "cust-1",
    });

    expect(plan.blockers).toEqual([]);
    expect(plan.root.label).toBe("Hannah Mercer");
    expect(plan.confirmationPhrase).toBe("DELETE CUSTOMER");
    expect(plan.will_delete).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "attachments", count: 1 }),
        expect.objectContaining({ table: "appointments", count: 1 }),
        expect.objectContaining({ table: "job_assignees", count: 1 }),
      ]),
    );
    expect(plan.will_anonymise).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "customers", count: 1 }),
        expect.objectContaining({ table: "jobs", count: 1 }),
        expect.objectContaining({ table: "quotes", count: 1 }),
        expect.objectContaining({ table: "invoices", count: 1 }),
        expect.objectContaining({ table: "payments", count: 1 }),
      ]),
    );
    expect(plan.storage_cleanup[0]).toMatchObject({ count: 2 });
    expect(plan.planHash).toHaveLength(64);
  });

  it("executes the plan by deleting operational rows and redacting retained rows", async () => {
    const db = baseDb();
    const supabase = fakeSupabase(db);
    const plan = await buildDeleteTrailPlan({
      supabase,
      tenantId: "tenant-1",
      rootType: "customer",
      rootId: "cust-1",
    });

    await executeDeleteTrailPlan({
      supabase,
      storageSupabase: supabase,
      tenantId: "tenant-1",
      actorId: "actor-1",
      rootType: "customer",
      rootId: "cust-1",
      reason: "Customer requested deletion",
      planHash: plan.planHash,
      confirmationPhrase: plan.confirmationPhrase,
    });

    expect(db.notes).toEqual([]);
    expect(db.attachments).toEqual([]);
    expect(db.job_assignees).toEqual([]);
    expect(db.customers[0]).toMatchObject({ full_name: "Deleted customer", archived: true, redacted_by: "actor-1" });
    expect(db.jobs[0]).toMatchObject({ title: "Deleted job", status: "aborted", redacted_by: "actor-1" });
    expect(db.quotes[0].line_items).toEqual([]);
    expect(db.invoices[0].line_items).toEqual([]);
    expect(db.payments[0].notes).toBeNull();
    expect(db.deletion_requests[0]).toMatchObject({ status: "completed", root_type: "customer" });
    expect(db.deletion_storage_tasks).toHaveLength(2);
  });

  it("rejects a stale plan hash", async () => {
    const db = baseDb();
    const supabase = fakeSupabase(db);

    await expect(
      executeDeleteTrailPlan({
        supabase,
        tenantId: "tenant-1",
        actorId: "actor-1",
        rootType: "customer",
        rootId: "cust-1",
        reason: "Customer requested deletion",
        planHash: "stale",
        confirmationPhrase: "DELETE CUSTOMER",
      }),
    ).rejects.toThrow("stale");
  });
});
