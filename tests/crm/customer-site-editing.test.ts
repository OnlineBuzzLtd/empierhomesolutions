import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Site } from "@/modules/crm/types";

const h = vi.hoisted(() => ({ role: "admin" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: vi.fn() }));
vi.mock("@/modules/crm/lib/auth", () => ({
  requireCrmUser: async () => ({ profile: { role: h.role } }),
  userCanManageSettings: () => false,
}));
vi.mock("@/modules/crm/lib/demo-state", () => ({ getCrmDemoState: async () => ({ mode: "live" }) }));
vi.mock("@/modules/crm/lib/customer-promises", () => ({ listCustomerPromises: async () => [] }));
vi.mock("@/modules/crm/components/shared/CustomerPromiseStrip", () => ({ CustomerPromiseStrip: () => null }));
vi.mock("@/modules/crm/lib/data", () => ({
  getCustomerDetail: vi.fn(),
  listUserProfiles: async () => [],
}));

import CustomerDetailPage from "@/app/(crm)/customers/[id]/page";
import { getCustomerDetail } from "@/modules/crm/lib/data";

const site: Site = {
  id: "site-primary",
  tenant_id: "tenant-1",
  customer_id: "customer-1",
  label: "Primary site",
  address_line1: "1 Example Road",
  address_line2: null,
  city: "Uxbridge",
  postcode: "UB8 1AA",
  access_notes: null,
  parking_notes: null,
  is_primary: true,
  created_at: "",
  updated_at: "",
};

async function render() {
  return renderToStaticMarkup(
    await CustomerDetailPage({
      params: Promise.resolve({ id: "customer-1" }),
      searchParams: Promise.resolve({}),
    }),
  );
}

describe("customer site editing rollout", () => {
  beforeEach(() => {
    h.role = "admin";
    // Exercise the production default: neither rollout variable is configured.
    vi.stubEnv("CRM_MULTISITE_ENABLED", undefined);
    vi.stubEnv("CRM_SITE_EDITING_ENABLED", undefined);
    vi.mocked(getCustomerDetail).mockResolvedValue({
      customer: {
        id: "customer-1",
        full_name: "Example Customer",
        created_at: "2026-09-01T00:00:00Z",
        address_line1: "2 Example Road",
        postcode: "UB8 2BB",
      },
      sites: [site, { ...site, id: "site-secondary", label: "Rental", is_primary: false }],
      jobs: [],
      leads: [],
      notes: [],
      assets: [],
      attachments: [],
      siteContacts: [],
      customFields: [],
    } as unknown as NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["admin", "management", "sales"])(
    "lets %s edit existing sites without the multi-site rollout",
    async (role) => {
      h.role = role;
      const html = await render();
      expect(html.match(/>Edit site</g)).toHaveLength(2);
      expect(html.match(/>Save Site</g)).toHaveLength(2);
      expect(html).toContain('value="1 Example Road"');
      expect(html).toContain('value="2 Example Road"');
      expect(html).toContain('href="#customer-sites"');
      expect(html).toContain('id="customer-sites"');
      expect(html).toContain("Customer and job site addresses are saved separately");
      expect(html).not.toContain("Set primary");
      expect(html).not.toContain("Add another site");
    },
  );

  it("keeps engineer access read-only", async () => {
    h.role = "engineer";
    const html = await render();
    expect(html).toContain("1 Example Road");
    expect(html).not.toContain(">Edit site<");
    expect(html).not.toContain(">Save Site<");
  });

  it("hides site editing when the rollback switch is set", async () => {
    vi.stubEnv("CRM_SITE_EDITING_ENABLED", "false");
    const html = await render();
    expect(html).not.toContain(">Edit site<");
    expect(html).not.toContain(">Save Site<");
    expect(html).toContain("1 Example Road");
  });

  it("retains the existing controls when multi-site is enabled", async () => {
    vi.stubEnv("CRM_MULTISITE_ENABLED", "true");
    vi.stubEnv("CRM_SITE_EDITING_ENABLED", "false");
    const html = await render();
    expect(html).toContain(">Edit site<");
    expect(html).toContain("Set primary");
    expect(html).toContain("Add another site");
  });
});
