import { describe, expect, it } from "vitest";
import { buildCrmSearchResults, normalizeCrmSearchQuery } from "@/modules/crm/lib/search";
import type {
  CustomerWithCounts,
  InvoiceWithRelations,
  JobWithRelations,
  LeadWithRelations,
  QuoteWithRelations,
} from "@/modules/crm/types";

describe("CRM search", () => {
  it("normalizes short queries and refuses to search one character", () => {
    expect(normalizeCrmSearchQuery("  BOILER  ")).toBe("boiler");
    expect(
      buildCrmSearchResults("a", {
        customers: [],
        leads: [],
        jobs: [],
        quotes: [],
        invoices: [],
      }),
    ).toEqual([]);
  });

  it("returns grouped CRM result types with operator-friendly destinations", () => {
    const results = buildCrmSearchResults("boiler", {
      customers: [
        {
          id: "customer-1",
          full_name: "Boiler Customer",
          phone: "07777123456",
          email: "customer@example.com",
          postcode: "UB8 1AA",
          address_line1: "1 High Street",
          active_job_count: 1,
        } as CustomerWithCounts,
      ],
      leads: [
        {
          id: "lead-1",
          status: "new",
          source: "Website form",
          problem_description: "Boiler losing pressure.",
          notes: null,
          created_at: "2026-06-23T10:00:00.000Z",
          customer: { full_name: "Lead Customer", phone: "07111222333", email: null, postcode: "UB8 2BB" },
          service: { id: "service-1", name: "Boilers" },
          job_type: { id: "job-type-1", name: "Boiler repair" },
        } as LeadWithRelations,
      ],
      jobs: [
        {
          id: "job-1",
          title: "Boiler repair",
          status: "booked",
          scheduled_date: "2026-06-25",
          customer: { full_name: "Job Customer", phone: "07000000000", postcode: "UB8 3CC" },
        } as JobWithRelations,
      ],
      quotes: [
        {
          id: "quote-1",
          quote_number: "Q-100",
          status: "sent",
          total: 1200,
          customer: { full_name: "Quote Customer" },
          job: { id: "job-1", title: "Boiler install" },
        } as QuoteWithRelations,
      ],
      invoices: [
        {
          id: "invoice-1",
          invoice_number: "INV-100",
          status: "unpaid",
          total: 240,
          customer: { full_name: "Invoice Customer" },
          job: { id: "job-2", title: "Boiler service" },
        } as InvoiceWithRelations,
      ],
    });

    expect(results.map((result) => result.type)).toEqual(["customer", "enquiry", "job", "quote", "invoice"]);
    expect(results.map((result) => result.href)).toEqual([
      "/customers/customer-1",
      "/leads?tab=all&highlight=lead-1",
      "/jobs/job-1",
      "/quotes/quote-1",
      "/invoices/invoice-1",
    ]);
    expect(results[0]).toMatchObject({
      callHref: "tel:07777123456",
      callNoteHref: "/customers/customer-1?call=1#customer-call-note",
    });
  });
});
