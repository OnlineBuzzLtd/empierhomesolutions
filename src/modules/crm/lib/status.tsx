import type { InvoiceScheduleStatus, InvoiceStatus, JobCertificateStatus, JobChecklistStatus, JobHazardStatus, JobPhaseStatus, JobStatus, JobVariationStatus, LeadStatus, PaymentStatus, PurchaseOrderStatus, QuoteStatus, StatusBadgeConfig, SupplierReconciliationStatus } from "@/modules/crm/types";

export const jobStatusConfig: Record<JobStatus, StatusBadgeConfig> = {
  enquiry: { label: "Enquiry", className: "bg-slate-100 text-slate-700" },
  booked: { label: "Booked", className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  invoiced: { label: "Invoiced", className: "bg-violet-100 text-violet-700" },
};

export const jobPhaseStatusConfig: Record<JobPhaseStatus, StatusBadgeConfig> = {
  planned: { label: "Planned", className: "bg-slate-100 text-slate-700" },
  ready: { label: "Ready", className: "bg-cyan-100 text-cyan-700" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
};

export const jobVariationStatusConfig: Record<JobVariationStatus, StatusBadgeConfig> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Declined", className: "bg-rose-100 text-rose-700" },
  invoiced: { label: "Invoiced", className: "bg-violet-100 text-violet-700" },
};

export const leadStatusConfig: Record<LeadStatus, StatusBadgeConfig> = {
  new: { label: "New", className: "bg-slate-100 text-slate-700" },
  contacted: { label: "Contacted", className: "bg-blue-100 text-blue-700" },
  follow_up: { label: "Follow Up", className: "bg-amber-100 text-amber-700" },
  survey_booked: { label: "Survey Booked", className: "bg-cyan-100 text-cyan-700" },
  quoted: { label: "Quoted", className: "bg-violet-100 text-violet-700" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700" },
  booked: { label: "Booked", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  lost: { label: "Lost", className: "bg-rose-100 text-rose-700" },
};

export const quoteStatusConfig: Record<QuoteStatus, StatusBadgeConfig> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Declined", className: "bg-rose-100 text-rose-700" },
};

export const invoiceStatusConfig: Record<InvoiceStatus, StatusBadgeConfig> = {
  unpaid: { label: "Unpaid", className: "bg-amber-100 text-amber-700" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Overdue", className: "bg-rose-100 text-rose-700" },
  void: { label: "Void", className: "bg-slate-100 text-slate-700" },
};

export const paymentStatusConfig: Record<PaymentStatus, StatusBadgeConfig> = {
  requested: { label: "Requested", className: "bg-blue-100 text-blue-700" },
  received: { label: "Received", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", className: "bg-rose-100 text-rose-700" },
  refunded: { label: "Refunded", className: "bg-slate-100 text-slate-700" },
};

export const invoiceScheduleStatusConfig: Record<InvoiceScheduleStatus, StatusBadgeConfig> = {
  planned: { label: "Planned", className: "bg-slate-100 text-slate-700" },
  invoiced: { label: "Invoiced", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700" },
};

export const jobHazardStatusConfig: Record<JobHazardStatus, StatusBadgeConfig> = {
  active: { label: "Active", className: "bg-rose-100 text-rose-700" },
  mitigated: { label: "Mitigated", className: "bg-amber-100 text-amber-700" },
  hazard_free: { label: "Hazard Free", className: "bg-emerald-100 text-emerald-700" },
};

export const jobChecklistStatusConfig: Record<JobChecklistStatus, StatusBadgeConfig> = {
  required: { label: "Required", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
};

export const jobCertificateStatusConfig: Record<JobCertificateStatus, StatusBadgeConfig> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
};

export const purchaseOrderStatusConfig: Record<PurchaseOrderStatus, StatusBadgeConfig> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  issued: { label: "Issued", className: "bg-blue-100 text-blue-700" },
  received: { label: "Received", className: "bg-cyan-100 text-cyan-700" },
  reconciled: { label: "Reconciled", className: "bg-emerald-100 text-emerald-700" },
};

export const supplierReconciliationStatusConfig: Record<SupplierReconciliationStatus, StatusBadgeConfig> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-700" },
  reconciled: { label: "Reconciled", className: "bg-emerald-100 text-emerald-700" },
};
