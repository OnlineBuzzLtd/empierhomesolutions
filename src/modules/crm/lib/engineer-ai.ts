import { isImageAttachment } from "@/modules/crm/lib/attachments";
import type { Attachment, EngineerAiAssistAction, EngineerAiAssistDraft, Invoice, JobWithRelations, Note, Quote } from "@/modules/crm/types";

type EngineerAiAssistSource = {
  job: JobWithRelations;
  notes: Note[];
  attachments: Attachment[];
  quote: Quote | null;
  invoice: Invoice | null;
  missingDocuments: string[];
};

function formatSchedule(job: Pick<JobWithRelations, "scheduled_date" | "scheduled_time">) {
  if (!job.scheduled_date && !job.scheduled_time) {
    return "Schedule not set";
  }

  return [job.scheduled_date ?? "Date TBC", job.scheduled_time ?? "Time TBC"].join(" at ");
}

function formatCustomerAddress(job: JobWithRelations) {
  return [job.customer?.address_line1, job.customer?.postcode].filter(Boolean).join(", ") || "Address not set";
}

function buildIssueLabel(job: JobWithRelations) {
  return job.description?.trim() || job.title;
}

function buildMissingEvidenceChecks(source: EngineerAiAssistSource) {
  const photoCount = source.attachments.filter((attachment) => isImageAttachment(attachment)).length;
  const noteCount = source.notes.length;
  const checks = [
    noteCount > 0 ? `Site notes logged: ${noteCount}` : "Site notes missing",
    photoCount > 0 ? `Site photos attached: ${photoCount}` : "Site photos missing",
    source.missingDocuments.length > 0 ? `Required documents missing: ${source.missingDocuments.join(", ")}` : "Required documents complete",
    source.quote ? `Quote linked: ${source.quote.quote_number}` : "No linked quote",
    source.invoice ? `Invoice linked: ${source.invoice.invoice_number}` : "No linked invoice",
  ];

  return { checks, photoCount, noteCount };
}

function buildSummaryDraft(source: EngineerAiAssistSource): EngineerAiAssistDraft {
  const latestNote = source.notes[0]?.body?.trim() || "No site notes recorded yet.";
  const checks = buildMissingEvidenceChecks(source).checks;
  const body = [
    `Issue: ${buildIssueLabel(source.job)}`,
    `Site: ${formatCustomerAddress(source.job)}`,
    `Customer: ${source.job.customer?.full_name ?? "Customer"}${source.job.customer?.phone ? `, ${source.job.customer.phone}` : ""}`,
    `Schedule: ${formatSchedule(source.job)}`,
    `Access / context: ${latestNote}`,
    "Do first: confirm the issue with the customer, take arrival photos, and record the first findings before work starts.",
  ].join("\n");

  return {
    action: "summary",
    title: "30-second job brief",
    summary: "Fast on-site briefing with issue, site context, and first action.",
    body,
    note_body: null,
    checks,
  };
}

function buildArrivalDraft(source: EngineerAiAssistSource): EngineerAiAssistDraft {
  const photoCount = source.attachments.filter((attachment) => isImageAttachment(attachment)).length;
  const body = [
    `Arrived on site for ${source.job.title}.`,
    `Customer: ${source.job.customer?.full_name ?? "Customer"}${source.job.customer?.phone ? ` (${source.job.customer.phone})` : ""}.`,
    `Address: ${formatCustomerAddress(source.job)}.`,
    `Customer confirmed issue: ${buildIssueLabel(source.job)}.`,
    "Initial assessment:",
    "- Access and safety checks completed.",
    "- Visual inspection started.",
    `- Existing site photos on record: ${photoCount}.`,
    "Next step:",
    "- Confirm root cause and start the first required task.",
  ].join("\n");

  return {
    action: "arrival_note_draft",
    title: "Arrival note draft",
    summary: "Structured arrival note ready to review and save.",
    body,
    note_body: body,
    checks: buildMissingEvidenceChecks(source).checks,
  };
}

function buildCompletionDraft(source: EngineerAiAssistSource): EngineerAiAssistDraft {
  const missingDocuments = source.missingDocuments.length > 0 ? source.missingDocuments.join(", ") : "None";
  const body = [
    `Work completed on ${source.job.title}.`,
    `Issue addressed: ${buildIssueLabel(source.job)}.`,
    "Completion summary:",
    "- Work carried out and system checked.",
    "- Site left safe and tidy.",
    "- Customer walked through the outcome and next steps.",
    `Outstanding documents: ${missingDocuments}.`,
    "Follow-up:",
    "- Upload final photos and any compliance documents before closing the job.",
  ].join("\n");

  return {
    action: "completion_note_draft",
    title: "Completion note draft",
    summary: "Close-out note draft with work summary and follow-up prompts.",
    body,
    note_body: body,
    checks: buildMissingEvidenceChecks(source).checks,
  };
}

function buildCustomerUpdateDraft(source: EngineerAiAssistSource): EngineerAiAssistDraft {
  const customerName = source.job.customer?.full_name ?? "Customer";
  const message = [
    `Hi ${customerName},`,
    "",
    `I have attended the job for ${source.job.title}.`,
    `Current update: ${buildIssueLabel(source.job)}.`,
    "I will keep the notes and any photos/documents updated in the CRM once the work is complete.",
    "",
    "Empire Home Solutions",
  ].join("\n");

  return {
    action: "customer_update_draft",
    title: "Customer update draft",
    summary: "Plain-language customer update ready to review.",
    body: message,
    note_body: `Customer update shared:\n\n${message}`,
    checks: buildMissingEvidenceChecks(source).checks,
  };
}

function buildMissingEvidenceDraft(source: EngineerAiAssistSource): EngineerAiAssistDraft {
  const evidence = buildMissingEvidenceChecks(source);
  const body = [
    "Evidence check:",
    ...evidence.checks.map((check) => `- ${check}`),
    "",
    "Recommended next step:",
    source.missingDocuments.length > 0 || evidence.noteCount === 0 || evidence.photoCount === 0
      ? "- Add the missing note/photo/document before marking the job complete."
      : "- Evidence looks complete for the current job stage.",
  ].join("\n");

  return {
    action: "missing_evidence_check",
    title: "Missing evidence check",
    summary: "Current notes, photos, documents, and commercial links checked against the job.",
    body,
    note_body: null,
    checks: evidence.checks,
  };
}

export function buildEngineerAiAssistDraft(source: EngineerAiAssistSource, action: EngineerAiAssistAction): EngineerAiAssistDraft {
  switch (action) {
    case "summary":
      return buildSummaryDraft(source);
    case "arrival_note_draft":
      return buildArrivalDraft(source);
    case "completion_note_draft":
      return buildCompletionDraft(source);
    case "customer_update_draft":
      return buildCustomerUpdateDraft(source);
    case "missing_evidence_check":
      return buildMissingEvidenceDraft(source);
  }
}
