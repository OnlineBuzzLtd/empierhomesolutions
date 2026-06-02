import { describe, expect, it } from "vitest";
import {
  buildAutomationPaymentPlan,
  draftQuoteForJob,
  isQuoteDraftingEnabledForTrigger,
  selectQuoteAutomationPackage,
} from "@/modules/crm/lib/quote-automation";
import type { Package, PackageItem } from "@/modules/crm/types";

type Row = Record<string, unknown>;

const TENANT_ID = "tenant-1";
const JOB_ID = "job-1";
const CUSTOMER_ID = "customer-1";
const SERVICE_ID = "svc-1";

const basePackage: Package = {
  id: "pkg-1",
  tenant_id: TENANT_ID,
  service_id: SERVICE_ID,
  job_type_id: null,
  name: "Fixed boiler service",
  description: null,
  default_markup_percent: null,
  is_active: true,
  image_url: null,
  ai_visible: true,
  ai_bookable: true,
  ai_price_enabled: true,
  ai_requires_office_quote: false,
  ai_default_duration_minutes: 60,
  ai_price_disclaimer: null,
  ai_pricing_style: "fixed",
  created_by: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

const baseItem: PackageItem = {
  id: "item-1",
  tenant_id: TENANT_ID,
  package_id: "pkg-1",
  product_id: null,
  description: "Service labour",
  qty: 1,
  unit_cost: 50,
  unit_price: 100,
  sort_order: 1,
};

class QueryBuilder {
  error: null = null;
  private filters: Array<(row: Row) => boolean> = [];
  private inserted: Row[] | null = null;
  private updatePayload: Row | null = null;
  private limitValue: number | null = null;

  constructor(
    private readonly table: string,
    private readonly rows: Record<string, Row[]>,
  ) {}

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  in(key: string, values: unknown[]) {
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

  insert(payload: Row | Row[]) {
    const payloads = Array.isArray(payload) ? payload : [payload];
    this.rows[this.table] ??= [];
    this.inserted = payloads.map((row, index) => ({
      id: `${this.table}-${this.rows[this.table].length + index + 1}`,
      created_at: "2026-06-01T12:00:00.000Z",
      ...row,
    }));
    this.rows[this.table].push(...this.inserted);
    return this;
  }

  update(payload: Row) {
    this.updatePayload = payload;
    return this;
  }

  returns<T>() {
    return Promise.resolve({ data: this.apply() as T, error: null });
  }

  async maybeSingle<T>() {
    return { data: (this.apply()[0] ?? null) as T | null, error: null };
  }

  async single<T>() {
    return { data: (this.inserted?.[0] ?? this.apply()[0] ?? null) as T | null, error: null };
  }

  then(resolve: (value: { data: Row[]; error: null }) => void) {
    if (this.updatePayload) {
      const matches = this.apply();
      for (const row of matches) Object.assign(row, this.updatePayload);
    }
    resolve({ data: this.apply(), error: null });
  }

  private apply() {
    let result = [...(this.rows[this.table] ?? [])].filter((row) => this.filters.every((filter) => filter(row)));
    if (this.limitValue !== null) result = result.slice(0, this.limitValue);
    return result;
  }
}

function createQuoteAutomationSupabase(overrides: Partial<Record<string, Row[]>> = {}) {
  const rows: Record<string, Row[]> = {
    tenant_settings: [
      {
        tenant_id: TENANT_ID,
        ai_quote_drafting_enabled: true,
        ai_quote_drafting_mode: "draft_after_booking_and_survey",
        default_payment_terms: null,
      },
    ],
    jobs: [
      {
        id: JOB_ID,
        tenant_id: TENANT_ID,
        customer_id: CUSTOMER_ID,
        service_id: SERVICE_ID,
        job_type_id: null,
        title: "Boiler service",
        description: null,
        visit_classification: "standard",
        commercial_stage: null,
        is_test: true,
        is_demo: true,
        demo_scenario_key: "demo",
        customer: { id: CUSTOMER_ID, full_name: "Demo Customer" },
        service: { id: SERVICE_ID, name: "Boilers", ai_requires_office_quote: false, ai_price_enabled: true },
        job_type: null,
      },
    ],
    quotes: [],
    packages: [basePackage],
    package_items: [baseItem],
    quote_versions: [],
    invoice_schedules: [],
    ...overrides,
  };
  return {
    rows,
    client: {
      schema: () => ({
        from: (table: string) => new QueryBuilder(table, rows),
        rpc: async () => ({ data: 42, error: null }),
      }),
    },
  };
}

describe("quote automation helpers", () => {
  it("keeps automatic quote drafting disabled by default", () => {
    expect(isQuoteDraftingEnabledForTrigger(null, "booking_created")).toBe(false);
    expect(isQuoteDraftingEnabledForTrigger({ ai_quote_drafting_enabled: false }, "survey_completed")).toBe(false);
    expect(
      isQuoteDraftingEnabledForTrigger(
        { ai_quote_drafting_enabled: true, ai_quote_drafting_mode: "draft_after_survey" },
        "booking_created",
      ),
    ).toBe(false);
  });

  it("allows survey and booking triggers only for the configured mode", () => {
    expect(
      isQuoteDraftingEnabledForTrigger(
        { ai_quote_drafting_enabled: true, ai_quote_drafting_mode: "draft_after_survey" },
        "survey_completed",
      ),
    ).toBe(true);
    expect(
      isQuoteDraftingEnabledForTrigger(
        { ai_quote_drafting_enabled: true, ai_quote_drafting_mode: "draft_after_booking_and_survey" },
        "booking_created",
      ),
    ).toBe(true);
  });

  it("selects the exact service/job-type package before service-only fallbacks", () => {
    const packages = [
      {
        id: "pkg-service",
        tenant_id: "tenant-1",
        service_id: "svc-1",
        job_type_id: null,
        name: "Service package",
        description: null,
        default_markup_percent: null,
        is_active: true,
        image_url: null,
        ai_visible: true,
        ai_bookable: true,
        ai_price_enabled: true,
        ai_requires_office_quote: false,
        ai_default_duration_minutes: null,
        ai_price_disclaimer: null,
        ai_pricing_style: "fixed" as const,
        created_by: null,
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "pkg-exact",
        tenant_id: "tenant-1",
        service_id: "svc-1",
        job_type_id: "type-1",
        name: "Exact package",
        description: null,
        default_markup_percent: null,
        is_active: true,
        image_url: null,
        ai_visible: true,
        ai_bookable: true,
        ai_price_enabled: true,
        ai_requires_office_quote: false,
        ai_default_duration_minutes: null,
        ai_price_disclaimer: null,
        ai_pricing_style: "fixed" as const,
        created_by: null,
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z",
      },
    ];

    expect(selectQuoteAutomationPackage(packages, { service_id: "svc-1", job_type_id: "type-1" })?.id).toBe("pkg-exact");
  });

  it("uses configured payment terms, with survey and service fallbacks", () => {
    expect(
      buildAutomationPaymentPlan(
        {
          default_payment_terms: {
            deposit_percent: 20,
            deposit_label: "Booking deposit",
            stages: [],
            final: { label: "Balance", due_offset_days: 7 },
          },
        },
        { visit_classification: "survey_assessment" },
      ).deposit_percent,
    ).toBe(20);

    expect(buildAutomationPaymentPlan(null, { visit_classification: "survey_assessment" }).deposit_percent).toBe(30);
    expect(buildAutomationPaymentPlan(null, { visit_classification: "standard" }).deposit_percent).toBe(0);
  });

  it("creates one draft quote, quote version, and invoice schedule for a fixed-price booking", async () => {
    const { client, rows } = createQuoteAutomationSupabase();

    const result = await draftQuoteForJob({
      supabase: client as never,
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      actorId: "user-1",
      triggerSource: "booking_created",
    });

    expect(result.status).toBe("created");
    expect(rows.quotes).toHaveLength(1);
    expect(rows.quote_versions).toHaveLength(1);
    expect(rows.invoice_schedules).toHaveLength(1);
    expect(rows.quotes[0]).toMatchObject({
      job_id: JOB_ID,
      customer_id: CUSTOMER_ID,
      status: "draft",
      is_test: true,
    });
    expect(rows.jobs[0].commercial_stage).toBe("quote_draft");
  });

  it("does not duplicate quotes when the automation is triggered again", async () => {
    const { client, rows } = createQuoteAutomationSupabase();
    await draftQuoteForJob({
      supabase: client as never,
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      triggerSource: "booking_created",
    });

    const result = await draftQuoteForJob({
      supabase: client as never,
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      triggerSource: "booking_created",
    });

    expect(result.status).toBe("skipped");
    expect(rows.quotes).toHaveLength(1);
    expect(result.quoteId).toBe(rows.quotes[0].id);
  });

  it("blocks booking-created drafts for non-fixed catalogue packages", async () => {
    const { client, rows } = createQuoteAutomationSupabase({
      packages: [{ ...basePackage, ai_pricing_style: "from" }],
    });

    const result = await draftQuoteForJob({
      supabase: client as never,
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      triggerSource: "booking_created",
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers[0]?.code).toBe("booking_quote_not_allowed");
    expect(rows.quotes).toHaveLength(0);
  });
});
