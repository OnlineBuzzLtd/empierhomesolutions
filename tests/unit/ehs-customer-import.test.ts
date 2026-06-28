import { describe, expect, it } from "vitest";

const lib = await import("../../scripts/ehs-customer-data-import-lib.mjs");

const catalog = lib.makeCatalog(
  [
    { id: "svc-boilers", slug: "boilers" },
    { id: "svc-power-flushing", slug: "power-flushing" },
  ],
  [
    { id: "jt-boiler-install", slug: "boiler-install" },
    { id: "jt-boiler-service", slug: "boiler-service" },
    { id: "jt-boiler-repair", slug: "boiler-repair" },
    { id: "jt-gas-safety", slug: "gas-safety-cert" },
    { id: "jt-power-flush", slug: "power-flush" },
  ],
);

type ImportPlanForTest = {
  customerCreates: Array<{ payload: Record<string, unknown> }>;
  leadCreates: Array<{ payload: Record<string, unknown> }>;
  jobCreates: Array<{ payload: Record<string, unknown> }>;
};

function workbook(customerRows: Array<Record<string, string>>, dealRows: Array<Record<string, string>>) {
  return {
    sheets: [
      { name: "customer_list", rows: customerRows },
      { name: "Deals", rows: dealRows },
    ],
  };
}

describe("EHS customer workbook import", () => {
  it("maps deal types and statuses to CRM service/job status records", () => {
    expect(lib.classifyDealType("Boiler Swap (combi)")).toEqual({
      serviceSlug: "boilers",
      jobTypeSlug: "boiler-install",
    });
    expect(lib.classifyDealType("Gas Safety")).toEqual({
      serviceSlug: "boilers",
      jobTypeSlug: "gas-safety-cert",
    });
    expect(lib.classifyDealType("Other")).toEqual({
      serviceSlug: null,
      jobTypeSlug: null,
    });

    expect(lib.mapDealStatus("Lead (new)")).toMatchObject({ leadStatus: "new", jobStatus: null });
    expect(lib.mapDealStatus("Survey (follow-up)")).toMatchObject({ leadStatus: "follow_up", jobStatus: null });
    expect(lib.mapDealStatus("Order (placed)")).toMatchObject({ leadStatus: "booked", jobStatus: "booked" });
    expect(lib.mapDealStatus("Job Completed")).toMatchObject({ leadStatus: "completed", jobStatus: "completed" });
    expect(lib.mapDealStatus("Cancelled - NO FURTHER ACTION")).toMatchObject({
      leadStatus: "lost",
      jobStatus: null,
    });
  });

  it("builds customer, site, lead, and job creates for importable workbook rows", () => {
    const prepared = lib.prepareWorkbookImport(
      workbook(
        [
          {
            Customer: "Alex Example",
            Email: "ALEX@example.COM",
            "Mobile / Contact": "7700900123",
            Address: "1 Sample Road, Uxbridge UB8 1AA",
            Notes: "Prefers mornings",
          },
        ],
        [
          {
            Date: "45000",
            Status: "Job Booked",
            "Deal ID": "D-001",
            Customer: "Alex Example",
            Address: "1 Sample Road, Uxbridge UB8 1AA",
            Type: "Boiler Service",
            Source: "Organic",
            Quotes: "Pending",
            Invoices: "n/a",
            Jobs: "Booked",
            Payments: "n/a",
          },
        ],
      ),
    );

    const plan = lib.buildImportPlan(prepared, lib.makeExistingState(), catalog) as ImportPlanForTest;

    expect(lib.summarizePlan(plan)).toMatchObject({
      customersToCreate: 1,
      sitesToCreate: 1,
      leadsToCreate: 1,
      jobsToCreate: 1,
      reviewItems: 0,
    });
    expect(plan.customerCreates[0].payload).toMatchObject({
      tenant_id: lib.EMPIRE_TENANT.id,
      full_name: "Alex Example",
      email: "alex@example.com",
      phone: "+447700900123",
      postcode: "UB8 1AA",
      is_test: false,
    });
    expect(plan.leadCreates[0].payload).toMatchObject({
      tenant_id: lib.EMPIRE_TENANT.id,
      service_id: "svc-boilers",
      job_type_id: "jt-boiler-service",
      status: "booked",
      is_test: false,
    });
    expect(plan.jobCreates[0].payload).toMatchObject({
      tenant_id: lib.EMPIRE_TENANT.id,
      service_id: "svc-boilers",
      job_type_id: "jt-boiler-service",
      status: "booked",
      is_test: false,
    });
  });

  it("sends contact matches with conflicting name or postcode to review instead of merging", () => {
    const prepared = lib.prepareWorkbookImport(
      workbook(
        [
          {
            Customer: "Different Person",
            Email: "same@example.com",
            "Mobile / Contact": "07700900123",
            Address: "9 Other Street UB9 9ZZ",
            Notes: "",
          },
        ],
        [],
      ),
    );
    const existing = lib.makeExistingState({
      customers: [
        {
          id: "existing-customer",
          tenant_id: lib.EMPIRE_TENANT.id,
          full_name: "Original Person",
          email: "same@example.com",
          phone: "07700900123",
          address_line1: "1 Old Street",
          postcode: "UB8 1AA",
          is_test: false,
        },
      ],
    });

    const plan = lib.buildImportPlan(prepared, existing, catalog);

    expect(plan.customerCreates).toHaveLength(0);
    expect(plan.reviewItems).toEqual([
      expect.objectContaining({
        kind: "customer_contact_conflict",
        rowNumber: 2,
      }),
    ]);
  });

  it("skips deals already imported by deal id", () => {
    const prepared = lib.prepareWorkbookImport(
      workbook(
        [
          {
            Customer: "Alex Example",
            Email: "alex@example.com",
            "Mobile / Contact": "07700900123",
            Address: "1 Sample Road UB8 1AA",
            Notes: "",
          },
        ],
        [
          {
            Date: "45000",
            Status: "Job Completed",
            "Deal ID": "D-001",
            Customer: "Alex Example",
            Address: "1 Sample Road UB8 1AA",
            Type: "Boiler Breakdown",
            Source: "Organic",
            Quotes: "No Quote",
            Invoices: "Invoiced",
            Jobs: "Completed",
            Payments: "Paid",
          },
        ],
      ),
    );
    const existing = lib.makeExistingState({
      customers: [
        {
          id: "existing-customer",
          tenant_id: lib.EMPIRE_TENANT.id,
          full_name: "Alex Example",
          email: "alex@example.com",
          phone: "07700900123",
          address_line1: "1 Sample Road UB8 1AA",
          postcode: "UB8 1AA",
          is_test: false,
        },
      ],
      sites: [
        {
          id: "existing-site",
          tenant_id: lib.EMPIRE_TENANT.id,
          customer_id: "existing-customer",
          address_line1: "1 Sample Road UB8 1AA",
          postcode: "UB8 1AA",
          is_demo: false,
        },
      ],
      leads: [
        {
          id: "existing-lead",
          tenant_id: lib.EMPIRE_TENANT.id,
          customer_id: "existing-customer",
          notes: "EHS workbook import\nDeal ID: D-001",
          is_test: false,
        },
      ],
      jobs: [
        {
          id: "existing-job",
          tenant_id: lib.EMPIRE_TENANT.id,
          customer_id: "existing-customer",
          lead_id: "existing-lead",
          description: "EHS workbook import\nDeal ID: D-001",
          is_test: false,
        },
      ],
    });

    const plan = lib.buildImportPlan(prepared, existing, catalog);

    expect(lib.summarizePlan(plan)).toMatchObject({
      customersToCreate: 0,
      sitesToCreate: 0,
      leadsToCreate: 0,
      jobsToCreate: 0,
      skippedDeals: 1,
      reviewItems: 0,
    });
  });
});
