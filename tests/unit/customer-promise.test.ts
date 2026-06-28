import { describe, expect, it } from "vitest";
import {
  buildCustomerPromiseSummary,
  buildExplicitPromiseSummary,
  buildLeadPromiseSummary,
  buildRecordPromiseSummary,
  choosePromiseSummary,
} from "@/modules/crm/lib/customer-promise";
import type { LeadWithRelations } from "@/modules/crm/types";
import type { CustomerPromiseWithOwner } from "@/modules/crm/lib/customer-promise";

function lead(overrides: Partial<LeadWithRelations> = {}): LeadWithRelations {
  return {
    id: "lead-1",
    tenant_id: "tenant-1",
    customer_id: "customer-1",
    possible_duplicate_customer_id: null,
    service_id: null,
    job_type_id: null,
    assigned_to: "user-1",
    status: "follow_up",
    source: "Manual",
    source_enum: "manual",
    next_action_at: "2026-06-25T10:00:00.000Z",
    notes: null,
    problem_description: "Boiler leaking.",
    affected_area: null,
    urgency_level: null,
    preferred_date_text: null,
    preferred_time_window: null,
    intake_source: "manual_crm",
    dedupe_result: null,
    submission_count: 1,
    customer_match_result: "matched",
    is_demo: false,
    demo_scenario_key: null,
    created_at: "2026-06-25T08:00:00.000Z",
    updated_at: "2026-06-25T08:00:00.000Z",
    customer: {
      id: "customer-1",
      full_name: "Jane Smith",
      phone: "07777123456",
      email: null,
      address_line1: "1 High Street",
      postcode: "UB8 1AA",
    },
    owner: { id: "profile-1", full_name: "Office Owner", role: "admin" },
    ...overrides,
  } as LeadWithRelations;
}

function promise(overrides: Partial<CustomerPromiseWithOwner> = {}): CustomerPromiseWithOwner {
  return {
    id: "promise-1",
    tenant_id: "tenant-1",
    customer_id: "customer-1",
    lead_id: "lead-1",
    job_id: null,
    quote_id: null,
    invoice_id: null,
    platform_conversation_id: null,
    platform_event_id: null,
    promise_type: "callback",
    title: "Call customer back",
    detail: "Customer asked for a callback.",
    owner_user_id: "user-1",
    due_at: "2026-06-25T10:00:00.000Z",
    channel: "phone",
    status: "open",
    origin: "office",
    idempotency_key: "promise-1",
    completed_at: null,
    created_by: "user-1",
    updated_by: "user-1",
    is_demo: false,
    demo_scenario_key: null,
    record_deleted_at: null,
    created_at: "2026-06-25T08:00:00.000Z",
    updated_at: "2026-06-25T08:00:00.000Z",
    owner: { id: "profile-1", user_id: "user-1", full_name: "Office Owner", role: "admin" },
    ...overrides,
  };
}

describe("buildLeadPromiseSummary", () => {
  it("shows the next scheduled customer promise", () => {
    expect(buildLeadPromiseSummary(lead(), new Date("2026-06-25T09:00:00.000Z"))).toMatchObject({
      state: "ready",
      title: "Next customer promise",
      ownerLabel: "Office Owner",
      channelLabel: "Phone",
    });
  });

  it("marks overdue promises", () => {
    expect(buildLeadPromiseSummary(lead(), new Date("2026-06-25T11:00:00.000Z"))).toMatchObject({
      state: "overdue",
      title: "Promise overdue",
    });
  });

  it("shows unset promises clearly", () => {
    expect(buildLeadPromiseSummary(lead({ next_action_at: null, assigned_to: null, owner: null }))).toMatchObject({
      state: "unset",
      title: "No next promise set",
      ownerLabel: "Unassigned",
      dueLabel: "No due time",
    });
  });
});

describe("buildRecordPromiseSummary", () => {
  it("marks record promises as overdue when the date has passed", () => {
    expect(
      buildRecordPromiseSummary(
        {
          dueAt: "2026-06-24",
          title: "Payment due",
          readyDetail: "Invoice has a due date.",
          overdueTitle: "Payment overdue",
          overdueDetail: "Chase this invoice.",
          unsetTitle: "No payment due date",
          unsetDetail: "Set a due date.",
          ownerLabel: "Accounts",
          channelLabel: "Phone",
          dateOnly: true,
        },
        new Date("2026-06-25T12:00:00.000Z"),
      ),
    ).toMatchObject({
      state: "overdue",
      title: "Payment overdue",
      ownerLabel: "Accounts",
    });
  });

  it("can keep completed records ready even when the due date is old", () => {
    expect(
      buildRecordPromiseSummary(
        {
          dueAt: "2026-06-24",
          title: "Payment due",
          readyDetail: "Invoice is paid.",
          unsetTitle: "No payment due date",
          unsetDetail: "Set a due date.",
          ignoreOverdue: true,
        },
        new Date("2026-06-25T12:00:00.000Z"),
      ),
    ).toMatchObject({
      state: "ready",
      title: "Payment due",
    });
  });
});

describe("buildCustomerPromiseSummary", () => {
  it("uses the earliest dated open lead promise for a customer", () => {
    const promise = buildCustomerPromiseSummary(
      [
        lead({ id: "later", next_action_at: "2026-06-26T10:00:00.000Z" }),
        lead({ id: "earlier", next_action_at: "2026-06-25T12:00:00.000Z" }),
      ],
      {},
      new Date("2026-06-25T09:00:00.000Z"),
    );

    expect(promise.state).toBe("ready");
    expect(promise.dueLabel).toContain("25 Jun 2026");
  });
});

describe("explicit customer promises", () => {
  it("summarises saved promises with owner, due time, and channel", () => {
    expect(buildExplicitPromiseSummary(promise(), new Date("2026-06-25T09:00:00.000Z"))).toMatchObject({
      id: "promise-1",
      source: "explicit",
      state: "ready",
      title: "Call customer back",
      ownerLabel: "Office Owner",
      channelLabel: "Phone",
      promiseType: "callback",
    });
  });

  it("prefers the earliest open saved promise over the derived fallback", () => {
    const selected = choosePromiseSummary(
      [
        promise({ id: "later", due_at: "2026-06-26T10:00:00.000Z", updated_at: "2026-06-25T08:00:00.000Z" }),
        promise({ id: "earlier", due_at: "2026-06-25T12:00:00.000Z", updated_at: "2026-06-25T08:00:00.000Z" }),
      ],
      buildLeadPromiseSummary(lead({ next_action_at: "2026-06-27T10:00:00.000Z" })),
      new Date("2026-06-25T09:00:00.000Z"),
    );

    expect(selected).toMatchObject({
      id: "earlier",
      source: "explicit",
      dueAt: "2026-06-25T12:00:00.000Z",
    });
  });

  it("falls back to derived guidance when no saved promise is open", () => {
    const selected = choosePromiseSummary(
      [promise({ status: "completed", completed_at: "2026-06-25T09:30:00.000Z" })],
      buildLeadPromiseSummary(lead(), new Date("2026-06-25T09:00:00.000Z")),
      new Date("2026-06-25T09:00:00.000Z"),
    );

    expect(selected).toMatchObject({
      source: "derived",
      title: "Next customer promise",
    });
  });
});
