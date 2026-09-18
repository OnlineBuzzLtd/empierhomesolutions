import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteCreateForm } from "@/modules/crm/components/forms/SiteCreateForm";
import { JobCreateForm } from "@/modules/crm/components/forms/JobCreateForm";
import type { Site } from "@/modules/crm/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const site: Site = {
  id: "site-1",
  tenant_id: "tenant-1",
  customer_id: "customer-1",
  label: "Rental property",
  address_line1: "1 Example Road",
  address_line2: null,
  city: "Uxbridge",
  postcode: "UB8 1AA",
  access_notes: "Use side entrance",
  parking_notes: null,
  is_primary: true,
  created_at: "",
  updated_at: "",
};

describe("customer site forms", () => {
  it("provides address, notes, customer identity and primary selection on creation", () => {
    const html = renderToStaticMarkup(createElement(SiteCreateForm, { customerId: "customer-1" }));
    expect(html).toContain('name="customer_id" value="customer-1"');
    for (const field of [
      "label",
      "address_line1",
      "address_line2",
      "city",
      "postcode",
      "access_notes",
      "parking_notes",
      "is_primary",
    ]) {
      expect(html).toContain(`name="${field}"`);
    }
    expect(html).toContain("Add Site");
  });

  it("prefills edits without silently changing the customer or primary", () => {
    const html = renderToStaticMarkup(createElement(SiteCreateForm, { customerId: site.customer_id, site }));
    expect(html).toContain('value="Rental property"');
    expect(html).toContain('value="UB8 1AA"');
    expect(html).toContain("Use side entrance");
    expect(html).not.toContain('name="customer_id"');
    expect(html).not.toContain('name="is_primary"');
    expect(html).toContain("Save Site");
  });

  it("distinguishes job sites using their postcode", () => {
    const html = renderToStaticMarkup(
      createElement(JobCreateForm, {
        customers: [],
        services: [],
        jobTypes: [],
        engineers: [],
        customFields: [],
        sites: [site],
        siteContacts: [],
      }),
    );
    expect(html).toContain("Rental property · UB8 1AA");
  });
});
