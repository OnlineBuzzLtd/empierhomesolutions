import { hasReceiptAttachment, materialsAnswerRequiresReceipt } from "@/modules/crm/lib/materials";
import type { Attachment, JobStatus, JobWithRelations } from "@/modules/crm/types";

export type EngineerFieldPhase = "pre_arrival" | "on_site" | "complete" | "closed";
export type EngineerFieldIssueSeverity = "blocker" | "warning";

export type EngineerFieldIssue = {
  id: string;
  severity: EngineerFieldIssueSeverity;
  title: string;
  detail: string;
  actionLabel: string;
};

export type EngineerFieldSummary = {
  phase: EngineerFieldPhase;
  headline: string;
  guidance: string;
  primaryActionLabel: string;
  canLeaveSite: boolean;
  blockers: EngineerFieldIssue[];
  warnings: EngineerFieldIssue[];
};

const closedStatuses = new Set<JobStatus>(["no_access", "aborted"]);
const completeStatuses = new Set<JobStatus>(["completed", "invoiced"]);

export function buildEngineerFieldSummary(
  job: Pick<
    JobWithRelations,
    "status" | "checklists" | "hazards" | "site" | "customer" | "description" | "problem_description"
  >,
  attachments: Array<Pick<Attachment, "file_type" | "file_name">>,
): EngineerFieldSummary {
  const blockers = buildCompletionBlockers(job, attachments);
  const warnings = buildFieldWarnings(job, attachments);
  const phase = getFieldPhase(job.status);

  if (phase === "pre_arrival") {
    return {
      phase,
      headline: "Go to the job",
      guidance: warnings.some((warning) => warning.id === "postcode")
        ? "Phone the customer to confirm the address before you travel."
        : "Use directions, call if needed, then tap Arrive when you are on site.",
      primaryActionLabel: "Arrive",
      canLeaveSite: false,
      blockers,
      warnings,
    };
  }

  if (phase === "on_site") {
    const canLeaveSite = blockers.length === 0;
    return {
      phase,
      headline: canLeaveSite ? "Ready to finish" : "Finish these before leaving",
      guidance: canLeaveSite
        ? "Add final notes/photos if needed, then leave site."
        : "The job report is not ready for office handoff until the blockers are cleared.",
      primaryActionLabel: canLeaveSite ? "Leave site" : "Open job report",
      canLeaveSite,
      blockers,
      warnings,
    };
  }

  if (phase === "complete") {
    return {
      phase,
      headline: "Job finished",
      guidance: "Office can invoice or close out from here.",
      primaryActionLabel: "View job report",
      canLeaveSite: true,
      blockers,
      warnings,
    };
  }

  return {
    phase,
    headline: job.status === "no_access" ? "No access recorded" : "Job closed",
    guidance: "Office should review the outcome before rebooking or closing the customer journey.",
    primaryActionLabel: "Review outcome",
    canLeaveSite: false,
    blockers,
    warnings,
  };
}

function getFieldPhase(status: JobStatus): EngineerFieldPhase {
  if (status === "booked" || status === "enquiry") {
    return "pre_arrival";
  }
  if (status === "in_progress") {
    return "on_site";
  }
  if (completeStatuses.has(status)) {
    return "complete";
  }
  if (closedStatuses.has(status)) {
    return "closed";
  }
  return "closed";
}

function buildCompletionBlockers(
  job: Pick<JobWithRelations, "checklists" | "hazards">,
  attachments: Array<Pick<Attachment, "file_type" | "file_name">>,
): EngineerFieldIssue[] {
  const blockers: EngineerFieldIssue[] = [];
  const mandatoryOutstanding = (job.checklists ?? []).filter(
    (checklist) => checklist.is_mandatory && checklist.status !== "completed",
  );
  if (mandatoryOutstanding.length > 0) {
    blockers.push({
      id: "mandatory-checklists",
      severity: "blocker",
      title:
        mandatoryOutstanding.length === 1
          ? "1 mandatory checklist is not done"
          : `${mandatoryOutstanding.length} mandatory checklists are not done`,
      detail: mandatoryOutstanding.map((checklist) => checklist.title).join(", "),
      actionLabel: "Open checklists",
    });
  }

  const activeHazards = (job.hazards ?? []).filter((hazard) => hazard.status !== "hazard_free");
  if (activeHazards.length > 0) {
    blockers.push({
      id: "active-hazards",
      severity: "blocker",
      title: activeHazards.length === 1 ? "1 hazard still needs action" : `${activeHazards.length} hazards need action`,
      detail: activeHazards.map((hazard) => hazard.title).join(", "),
      actionLabel: "Open hazards",
    });
  }

  if (materialsAnswerRequiresReceipt(job.checklists ?? []) && !hasReceiptAttachment(attachments)) {
    blockers.push({
      id: "materials-receipt",
      severity: "blocker",
      title: "Receipt needed for materials",
      detail: "Materials were marked as used, but no receipt is attached.",
      actionLabel: "Add receipt",
    });
  }

  return blockers;
}

function buildFieldWarnings(
  job: Pick<JobWithRelations, "site" | "customer" | "description" | "problem_description">,
  attachments: Array<Pick<Attachment, "file_type" | "file_name">>,
): EngineerFieldIssue[] {
  const warnings: EngineerFieldIssue[] = [];
  if (!job.site?.postcode && !job.customer?.postcode) {
    warnings.push({
      id: "postcode",
      severity: "warning",
      title: "Address needs confirming",
      detail: "No postcode is saved on the job. Confirm it before travelling or finishing.",
      actionLabel: "Call customer",
    });
  }

  if (attachments.length === 0) {
    warnings.push({
      id: "photos",
      severity: "warning",
      title: "No photos added",
      detail: "A before or after photo helps the office answer customer questions later.",
      actionLabel: "Add photo",
    });
  }

  if (!job.description && !job.problem_description) {
    warnings.push({
      id: "brief",
      severity: "warning",
      title: "Job brief is light",
      detail: "There is no detailed problem description saved against this job.",
      actionLabel: "Add note",
    });
  }

  return warnings;
}
