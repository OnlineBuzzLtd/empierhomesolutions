import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("JobCreateForm", () => {
  it("preselects customer, site, and site contact defaults", async () => {
    vi.resetModules();
    vi.doMock("@/modules/crm/components/forms/ApiForm", () => ({
      ApiForm: ({ children }: { children: ReactNode }) => createElement("form", null, children),
    }));
    vi.doMock("@/modules/crm/components/forms/DynamicCustomFields", () => ({
      DynamicCustomFields: () => null,
    }));

    const { JobCreateForm } = await import("@/modules/crm/components/forms/JobCreateForm");
    const html = renderToStaticMarkup(
      createElement(JobCreateForm, {
        customers: [
          {
            id: "cust-1",
            full_name: "Hannah Mercer",
            phone: null,
            email: null,
            address_line1: null,
            address_line2: null,
            city: null,
            postcode: null,
            property_type: null,
            occupancy_type: null,
            source: null,
            referral_notes: null,
            notes: null,
            archived: false,
            created_at: "2026-05-26T00:00:00.000Z",
            updated_at: "2026-05-26T00:00:00.000Z",
          },
        ],
        services: [],
        jobTypes: [],
        sites: [
          {
            id: "site-1",
            tenant_id: "tenant-1",
            customer_id: "cust-1",
            label: "Home",
            address_line1: null,
            address_line2: null,
            city: null,
            postcode: null,
            access_notes: null,
            parking_notes: null,
            is_primary: true,
            created_at: "2026-05-26T00:00:00.000Z",
            updated_at: "2026-05-26T00:00:00.000Z",
            customer: { id: "cust-1", full_name: "Hannah Mercer" },
          },
        ],
        siteContacts: [
          {
            id: "contact-1",
            tenant_id: "tenant-1",
            site_id: "site-1",
            full_name: "Hannah Mercer",
            phone: null,
            email: null,
            role_label: "Site contact",
            is_primary: true,
            created_at: "2026-05-26T00:00:00.000Z",
            updated_at: "2026-05-26T00:00:00.000Z",
            site: { id: "site-1", label: "Home", customer_id: "cust-1" },
          },
        ],
        engineers: [],
        customFields: [],
        defaultCustomerId: "cust-1",
        defaultSiteId: "site-1",
        defaultSiteContactId: "contact-1",
      }),
    );

    expect(html).toContain("Creating job for Hannah Mercer");
    expect(html).toMatch(/<option[^>]*(selected=""[^>]*value="cust-1"|value="cust-1"[^>]*selected="")/);
    expect(html).toMatch(/<option[^>]*(selected=""[^>]*value="site-1"|value="site-1"[^>]*selected="")/);
    expect(html).toMatch(/<option[^>]*(selected=""[^>]*value="contact-1"|value="contact-1"[^>]*selected="")/);
  });
});
