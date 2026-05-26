import type { Attachment, JobChecklist } from "@/modules/crm/types";

export const materialsUsedQuestionTitle = "Materials used?";

export function isMaterialsUsedChecklist(checklist: Pick<JobChecklist, "title">) {
  return checklist.title.trim().toLowerCase().replace(/\s+/g, " ") === materialsUsedQuestionTitle.toLowerCase();
}

export function materialsAnswerRequiresReceipt(checklists: Array<Pick<JobChecklist, "title" | "notes"> & { status: string }>) {
  const checklist = checklists.find(isMaterialsUsedChecklist);
  if (!checklist || checklist.status !== "completed") {
    return false;
  }

  return (checklist.notes ?? "").trim().toLowerCase() === "yes";
}

export function hasReceiptAttachment(attachments: Array<Pick<Attachment, "file_type" | "file_name">>) {
  return attachments.some((attachment) => {
    const type = attachment.file_type.trim().toLowerCase();
    const name = attachment.file_name.trim().toLowerCase();
    return type === "receipt" || type.includes("receipt") || name.includes("receipt");
  });
}
