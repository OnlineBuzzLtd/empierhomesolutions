import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("LeadCreateForm", () => {
  it("renders a phone-note-first enquiry form with advanced CRM details collapsed", async () => {
    vi.resetModules();
    vi.doMock("@/modules/crm/components/forms/ApiForm", () => ({
      ApiForm: ({
        children,
        redirectOnSuccess,
      }: {
        children: ReactNode;
        redirectOnSuccess?: string;
      }) => createElement("form", { "data-redirect-on-success": redirectOnSuccess }, children),
    }));
    vi.doMock("@/modules/crm/components/forms/DynamicCustomFields", () => ({
      DynamicCustomFields: () => createElement("div", { "data-custom-fields": "lead" }),
    }));

    const { LeadCreateForm } = await import("@/modules/crm/components/forms/LeadCreateForm");
    const html = renderToStaticMarkup(
      createElement(LeadCreateForm, {
        customers: [
          {
            id: "cust-1",
            full_name: "Hannah Mercer",
            phone: "07123456789",
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
        services: [
          {
            id: "service-1",
            slug: "boilers",
            name: "Boilers",
            active: true,
            launch_date: null,
            created_at: "2026-05-26T00:00:00.000Z",
          },
        ],
        jobTypes: [
          {
            id: "job-type-1",
            service_id: "service-1",
            slug: "boiler-repair",
            name: "Boiler Repair",
            description: null,
            active: true,
            created_at: "2026-05-26T00:00:00.000Z",
          },
        ],
        users: [
          {
            id: "profile-1",
            user_id: "11111111-1111-4111-8111-111111111111",
            tenant_id: "tenant-1",
            email: "owner@example.com",
            full_name: "Office Owner",
            role: "admin",
            phone: null,
            emergency_contact: null,
            agreed_hours: null,
            pay_type: null,
            pay_notes: null,
            contract_file_url: null,
            active: true,
            created_at: "2026-05-26T00:00:00.000Z",
            updated_at: "2026-05-26T00:00:00.000Z",
          },
        ],
        customFields: [],
        successRedirectHref: "/leads?tab=todo",
      }),
    );

    expect(html).toContain('data-redirect-on-success="/leads?tab=todo"');
    expect(html).toContain('type="hidden"');
    expect(html).toContain('name="status"');
    expect(html).toContain('value="new"');
    expect(html).toContain("Customer name");
    expect(html).toContain('name="customer_full_name"');
    expect(html).toContain('name="customer_phone"');
    expect(html).toContain('name="customer_email"');
    expect(html).toContain('name="customer_postcode"');
    expect(html).toContain("Existing customer, optional");
    expect(html).toContain("Hannah Mercer - 07123456789");
    expect(html).toContain("Problem");
    expect(html).toContain("Phone note");
    expect(html).toContain("More details");
    expect(html).toContain('name="source"');
    expect(html).toContain('name="assigned_to"');
    expect(html).toContain('data-custom-fields="lead"');
    expect(html).not.toContain(">Status</span>");
  });
});
