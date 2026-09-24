// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteCreateForm } from "@/modules/crm/components/forms/SiteCreateForm";
import type { Site } from "@/modules/crm/types";

const h = vi.hoisted(() => ({ refresh: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/modules/crm/components/client/CrmClientRuntime", () => ({
  invalidateCrmClientCache: h.invalidate,
}));

const site: Site = {
  id: "site-1",
  tenant_id: "tenant-1",
  customer_id: "customer-1",
  label: "Primary site",
  address_line1: "1 Example Road",
  address_line2: "Old flat",
  city: "Uxbridge",
  postcode: "UB8 1AA",
  access_notes: null,
  parking_notes: null,
  is_primary: true,
  created_at: "",
  updated_at: "",
};
let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(SiteCreateForm, { customerId: site.customer_id, site }));
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function submit() {
  const form = container.querySelector("form")!;
  (form.elements.namedItem("address_line1") as HTMLInputElement).value = "2 Example Road";
  (form.elements.namedItem("address_line2") as HTMLInputElement).value = "";
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("saving the existing primary site form", () => {
  it("sends the edited address to the site endpoint and refreshes linked job displays", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, site }) });
    vi.stubGlobal("fetch", fetchMock);
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/crm/sites/site-1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({
      label: "Primary site",
      address_line1: "2 Example Road",
      address_line2: "",
      city: "Uxbridge",
      postcode: "UB8 1AA",
      access_notes: "",
      parking_notes: "",
    });
    expect(h.refresh).toHaveBeenCalledOnce();
    expect(h.invalidate).toHaveBeenCalledWith([
      "/api/crm/customers",
      "/api/crm/jobs",
      "/api/crm/dashboard/summary",
    ]);
    expect(container.textContent).toContain("Saved.");
  });

  it("keeps edits visible and displays a failed save without reporting success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          json: async () => ({ error: "Unable to save the site. Please try again." }),
        }),
    );
    await submit();
    expect(container.textContent).toContain("Unable to save the site. Please try again.");
    expect(container.textContent).not.toContain("Saved.");
    expect((container.querySelector('[name="address_line1"]') as HTMLInputElement).value).toBe(
      "2 Example Road",
    );
    expect(h.refresh).not.toHaveBeenCalled();
    expect(h.invalidate).not.toHaveBeenCalled();
    expect(container.querySelector("button")!.disabled).toBe(false);
  });
});
