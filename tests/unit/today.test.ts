import { describe, expect, it } from "vitest";
import { buildTodayAttentionItems, countDueFollowUpItems } from "@/modules/crm/lib/today";

describe("buildTodayAttentionItems", () => {
  it("prioritizes enquiries, AI handoffs, money, jobs, and quote review actions", () => {
    const items = buildTodayAttentionItems({
      newLeadCount: 3,
      followUpDueCount: 4,
      aiReceptionistReviewCount: 2,
      unpaidInvoicesTotal: 1500,
      todaysJobs: [{ id: "job-1" }, { id: "job-2" }] as never,
    });

    expect(items.map((item) => item.id)).toEqual(["enquiries", "follow-ups", "ai-review", "money", "jobs", "quotes"]);
    expect(items[0]).toMatchObject({ href: "/leads?tab=todo", action: "Review", priority: "high", value: "3" });
    expect(items[1]).toMatchObject({ href: "/inbox", action: "Call", priority: "high", value: "4" });
    expect(items[2]).toMatchObject({ href: "/ai-hub?tab=needs-review", priority: "high", value: "2" });
    expect(items[3]).toMatchObject({ href: "/invoices", action: "Chase", priority: "medium", value: "£1,500.00" });
  });

  it("keeps a quote review action visible when no urgent work exists", () => {
    expect(
      buildTodayAttentionItems({
        newLeadCount: 0,
        followUpDueCount: 0,
        aiReceptionistReviewCount: 0,
        unpaidInvoicesTotal: 0,
        todaysJobs: [],
      }),
    ).toEqual([
      expect.objectContaining({
        id: "quotes",
        title: "Quotes",
        href: "/quotes",
      }),
    ]);
  });
});

describe("countDueFollowUpItems", () => {
  it("counts overdue and due-today lead follow-ups and saved promises", () => {
    expect(
      countDueFollowUpItems(
        [
          { source: "lead_follow_up", status: "scheduled", starts_at: "2026-06-24T09:00:00.000Z" },
          { source: "lead_follow_up", status: "scheduled", starts_at: "2026-06-25T19:00:00.000Z" },
          { source: "lead_follow_up", status: "scheduled", starts_at: "2026-06-26T09:00:00.000Z" },
          { source: "customer_promise", status: "scheduled", starts_at: "2026-06-25T10:00:00.000Z" },
          { source: "lead_follow_up", status: "completed", starts_at: "2026-06-24T09:00:00.000Z" },
          { source: "appointment", status: "scheduled", starts_at: "2026-06-24T09:00:00.000Z" },
        ] as never,
        new Date("2026-06-25T08:00:00.000Z"),
      ),
    ).toBe(3);
  });
});
