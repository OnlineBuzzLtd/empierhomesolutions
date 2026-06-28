import { describe, expect, it } from "vitest";
import { buildOfficeInboxQueue } from "@/modules/crm/lib/office-inbox";
import type { CalendarItem } from "@/modules/crm/types";
import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";

function followUp(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: "lead-follow-up-lead-1",
    customer_id: "customer-1",
    lead_id: "lead-1",
    job_id: null,
    assigned_to: null,
    type: "follow_up",
    title: "Lead follow-up · Jane Smith",
    starts_at: "2026-06-25T08:00:00.000Z",
    ends_at: "2026-06-25T08:00:00.000Z",
    status: "scheduled",
    reminder_offset_minutes: null,
    recurrence_rule: null,
    created_at: "2026-06-25T08:00:00.000Z",
    source: "lead_follow_up",
    customer: { id: "customer-1", full_name: "Jane Smith", postcode: "UB8 1AA" },
    lead: { id: "lead-1", status: "new", source: "Website" },
    owner: null,
    recurrence_origin_id: null,
    entity_link: "/leads",
    synthetic: true,
    ...overrides,
  } as CalendarItem;
}

function customerPromise(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return followUp({
    id: "customer-promise-promise-1",
    lead_id: null,
    job_id: "job-1",
    assigned_to: "user-1",
    title: "Quote follow-up · Jane Smith",
    source: "customer_promise",
    lead: null,
    owner: { id: "profile-1", full_name: "Office Owner", role: "sales" },
    recurrence_origin_id: "promise-1",
    entity_link: "/jobs/job-1",
    ...overrides,
  });
}

function conversation(overrides: Partial<PlatformConversationRecord> = {}): PlatformConversationRecord {
  return {
    link: {
      id: "link-1",
      workspace_id: "workspace-1",
      tenant_id: "tenant-1",
      conversation_id: "conversation-1",
      customer_id: null,
      lead_id: "lead-2",
      job_id: null,
      callback_appointment_id: null,
      booking_appointment_id: null,
      latest_channel: "voice",
      identity_phone: "07777123456",
      identity_email: null,
      metadata: {},
      latest_event_at: "2026-06-25T09:00:00.000Z",
      created_at: "2026-06-25T09:00:00.000Z",
      updated_at: "2026-06-25T09:00:00.000Z",
    },
    customer: null,
    lead: {
      id: "lead-2",
      status: "new",
      source: "voice",
      next_action_at: null,
      updated_at: "2026-06-25T09:00:00.000Z",
    },
    job: null,
    callbackAppointment: null,
    bookingAppointment: null,
    ...overrides,
  };
}

describe("buildOfficeInboxQueue", () => {
  it("combines AI handoffs and lead follow-ups into a priority queue", () => {
    const queue = buildOfficeInboxQueue({
      calendarItems: [followUp()],
      reviewRecords: [conversation()],
      now: new Date("2026-06-25T08:30:00.000Z"),
    });

    expect(queue.items.map((item) => item.id)).toEqual(["lead-follow-up:lead-follow-up-lead-1", "ai-review:link-1"]);
    expect(queue.items[0]).toMatchObject({
      title: "Jane Smith",
      dueLabel: "Overdue",
      href: "/leads?tab=todo&highlight=lead-1",
      action: "Call",
      priority: "high",
    });
    expect(queue.items[1]).toMatchObject({
      title: "07777123456",
      dueLabel: "Today",
      href: "/ai-hub?tab=needs-review",
      action: "Review",
      priority: "high",
    });
    expect(queue.summary).toEqual({
      totalCount: 2,
      aiReviewCount: 1,
      leadFollowUpCount: 1,
      overdueCount: 1,
      firstAction: "Clear overdue follow-ups first",
    });
  });

  it("suppresses completed follow-ups and limits visible items", () => {
    const queue = buildOfficeInboxQueue({
      calendarItems: [
        followUp({ id: "done-follow-up", status: "completed" }),
        followUp({ id: "future-follow-up", starts_at: "2026-06-26T09:00:00.000Z" }),
      ],
      reviewRecords: [conversation()],
      now: new Date("2026-06-25T08:30:00.000Z"),
      limit: 1,
    });

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]?.id).toBe("ai-review:link-1");
    expect(queue.summary.totalCount).toBe(2);
  });

  it("adds saved customer promises to the follow-up queue", () => {
    const queue = buildOfficeInboxQueue({
      calendarItems: [customerPromise({ starts_at: "2026-06-25T10:00:00.000Z" })],
      reviewRecords: [],
      now: new Date("2026-06-25T08:30:00.000Z"),
    });

    expect(queue.items[0]).toMatchObject({
      id: "customer-promise:customer-promise-promise-1",
      kind: "customer_promise",
      title: "Jane Smith",
      detail: "Quote follow-up · Jane Smith · UB8 1AA · Owner: Office Owner",
      href: "/jobs/job-1",
      action: "Open",
      priority: "normal",
    });
    expect(queue.summary.leadFollowUpCount).toBe(1);
  });

  it("returns a clear empty state summary", () => {
    expect(buildOfficeInboxQueue({ calendarItems: [], reviewRecords: [] }).summary).toEqual({
      totalCount: 0,
      aiReviewCount: 0,
      leadFollowUpCount: 0,
      overdueCount: 0,
      firstAction: "No urgent inbox work",
    });
  });
});
