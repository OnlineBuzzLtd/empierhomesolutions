import { describe, expect, it } from "vitest";
import { buildEngineerFieldSummary } from "@/modules/crm/lib/engineer-field";
import type { Attachment, JobWithRelations } from "@/modules/crm/types";

const baseJob = {
  status: "in_progress",
  description: "Boiler fault investigation",
  problem_description: null,
  customer: {
    id: "customer-1",
    full_name: "Jane Smith",
    phone: "07700900123",
    email: null,
    address_line1: "1 Test Street",
    postcode: "UB8 1AA",
  },
  site: {
    id: "site-1",
    label: "Home",
    address_line1: "1 Test Street",
    city: "Uxbridge",
    postcode: "UB8 1AA",
    access_notes: null,
    parking_notes: null,
  },
  hazards: [],
  checklists: [],
} satisfies Pick<
  JobWithRelations,
  "status" | "description" | "problem_description" | "customer" | "site" | "hazards" | "checklists"
>;

const photo = {
  file_type: "image/jpeg",
  file_name: "after-photo.jpg",
} satisfies Pick<Attachment, "file_type" | "file_name">;

describe("engineer field summary", () => {
  it("marks an in-progress job as ready to finish when there are no blockers", () => {
    const summary = buildEngineerFieldSummary(baseJob, [photo]);

    expect(summary.phase).toBe("on_site");
    expect(summary.canLeaveSite).toBe(true);
    expect(summary.headline).toBe("Ready to finish");
    expect(summary.blockers).toEqual([]);
  });

  it("blocks leaving site until mandatory checklists are complete", () => {
    const summary = buildEngineerFieldSummary(
      {
        ...baseJob,
        checklists: [
          {
            id: "checklist-1",
            tenant_id: "tenant-1",
            job_id: "job-1",
            title: "Gas safety check",
            notes: null,
            status: "required",
            is_mandatory: true,
            completed_at: null,
            created_at: "2026-06-25T10:00:00.000Z",
            updated_at: "2026-06-25T10:00:00.000Z",
          },
        ],
      },
      [photo],
    );

    expect(summary.canLeaveSite).toBe(false);
    expect(summary.primaryActionLabel).toBe("Open job report");
    expect(summary.blockers).toEqual([
      expect.objectContaining({
        id: "mandatory-checklists",
        title: "1 mandatory checklist is not done",
      }),
    ]);
  });

  it("requires a receipt when materials were recorded as used", () => {
    const summary = buildEngineerFieldSummary(
      {
        ...baseJob,
        checklists: [
          {
            id: "checklist-1",
            tenant_id: "tenant-1",
            job_id: "job-1",
            title: "Materials used?",
            notes: "Yes",
            status: "completed",
            is_mandatory: true,
            completed_at: "2026-06-25T10:20:00.000Z",
            created_at: "2026-06-25T10:00:00.000Z",
            updated_at: "2026-06-25T10:20:00.000Z",
          },
        ],
      },
      [photo],
    );

    expect(summary.canLeaveSite).toBe(false);
    expect(summary.blockers).toContainEqual(
      expect.objectContaining({
        id: "materials-receipt",
        title: "Receipt needed for materials",
      }),
    );
  });

  it("surfaces postcode confirmation before travel without blocking arrival", () => {
    const summary = buildEngineerFieldSummary(
      {
        ...baseJob,
        status: "booked",
        customer: {
          ...baseJob.customer,
          postcode: null,
        },
        site: {
          ...baseJob.site,
          postcode: null,
        },
      },
      [photo],
    );

    expect(summary.phase).toBe("pre_arrival");
    expect(summary.primaryActionLabel).toBe("Arrive");
    expect(summary.warnings).toContainEqual(
      expect.objectContaining({
        id: "postcode",
        title: "Address needs confirming",
      }),
    );
  });
});
