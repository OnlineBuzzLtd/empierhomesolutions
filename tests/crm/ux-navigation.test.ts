import { describe, expect, it } from "vitest";
import {
  getAiReceptionistRedirect,
  getCrmNavGroups,
  getEngineerRedirect,
} from "@/modules/crm/lib/ux-navigation";

describe("CRM UX navigation", () => {
  it("orders admin navigation around the trade workflow", () => {
    const [group] = getCrmNavGroups(true, false);

    expect(group?.items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Enquiries",
      "Jobs",
      "Scheduler",
      "Customers",
      "Quotes",
      "Invoices",
      "AI Receptionist",
      "More",
    ]);
  });

  it("keeps secondary tools inside More", () => {
    const [group] = getCrmNavGroups(true, false);
    const more = group?.items.find((item) => item.label === "More");

    expect(more?.children?.map((item) => item.label)).toEqual([
      "Team",
      "Reports",
      "Settings",
      "Suppliers",
      "Products",
      "Packages",
      "Templates",
      "Integrations",
    ]);
  });

  it("shows the demo AI UI in More only when enabled", () => {
    const [withoutDemo] = getCrmNavGroups(true, false);
    const [withDemo] = getCrmNavGroups(true, false, true);

    expect(withoutDemo?.items.find((item) => item.label === "More")?.children?.map((item) => item.label)).not.toContain(
      "Demo AI UI",
    );
    expect(withDemo?.items.find((item) => item.label === "More")?.children?.map((item) => item.label)).toContain(
      "Demo AI UI",
    );
  });

  it("keeps the engineer navigation field-focused", () => {
    const [group] = getCrmNavGroups(false, true);

    expect(group?.items.map((item) => item.label)).toEqual(["Today", "Diary", "Jobs", "Profile"]);
  });

  it("redirects engineers away from office CRM screens", () => {
    expect(getEngineerRedirect("/leads")).toBe("/dashboard");
    expect(getEngineerRedirect("/quotes/quote-1")).toBe("/dashboard");
    expect(getEngineerRedirect("/ai-hub")).toBe("/dashboard");
    expect(getEngineerRedirect("/calendar")).toBe("/diary");
    expect(getEngineerRedirect("/jobs")).toBeNull();
    expect(getEngineerRedirect("/diary")).toBeNull();
  });

  it("consolidates direct AI routes into AI Receptionist tabs", () => {
    expect(getAiReceptionistRedirect("/inbox")).toBe("/ai-hub?tab=conversations");
    expect(getAiReceptionistRedirect("/calls")).toBe("/ai-hub?tab=missed-calls");
    expect(getAiReceptionistRedirect("/automations")).toBe("/ai-hub?tab=follow-ups");
    expect(getAiReceptionistRedirect("/ai-settings")).toBe("/ai-hub?tab=settings");
    expect(getAiReceptionistRedirect("/ai-hub")).toBeNull();
  });
});
