import type { InvoiceStatus, JobStatus, LeadStatus, PaymentStatus, QuoteStatus, StatusBadgeConfig } from "@/modules/crm/types";

export const jobStatusConfig: Record<JobStatus, StatusBadgeConfig> = {
  enquiry: { label: "Enquiry", className: "bg-slate-100 text-slate-700" },
  booked: { label: "Booked", className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
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
