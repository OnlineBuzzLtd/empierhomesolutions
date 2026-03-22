import type { JobStatus, LeadStatus, ReportsSummary } from "@/modules/crm/types";

type ReportsInput = {
  invoices: Array<{ total: number | string | null; status: string }>;
  leads: Array<{ status: LeadStatus }>;
  jobs: Array<{ status: JobStatus; assigned_engineer: string | null }>;
  expenses: Array<{ amount: number | string | null }>;
};

export function buildReportsSummary(input: ReportsInput): ReportsSummary {
  const totalRevenue = input.invoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
  const unpaidRevenue = input.invoices
    .filter((invoice) => invoice.status === "unpaid" || invoice.status === "overdue")
    .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
  const totalExpenses = input.expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  const engineerMap = new Map<string, { engineer: string; totalJobs: number; completedJobs: number; openJobs: number }>();
  for (const job of input.jobs) {
    const engineer = job.assigned_engineer || "Unassigned";
    const current = engineerMap.get(engineer) ?? { engineer, totalJobs: 0, completedJobs: 0, openJobs: 0 };
    current.totalJobs += 1;
    if (job.status === "completed" || job.status === "invoiced") {
      current.completedJobs += 1;
    }
    if (["enquiry", "booked", "in_progress"].includes(job.status)) {
      current.openJobs += 1;
    }
    engineerMap.set(engineer, current);
  }

  return {
    totalRevenue,
    unpaidRevenue,
    invoiceCount: input.invoices.length,
    paidInvoiceCount: input.invoices.filter((invoice) => invoice.status === "paid").length,
    leadCount: input.leads.length,
    convertedLeadCount: input.leads.filter((lead) => ["accepted", "booked", "completed"].includes(lead.status)).length,
    jobCount: input.jobs.length,
    completedJobCount: input.jobs.filter((job) => job.status === "completed" || job.status === "invoiced").length,
    totalExpenses,
    profitEstimate: totalRevenue - totalExpenses,
    engineerWorkload: Array.from(engineerMap.values()).sort((a, b) => b.totalJobs - a.totalJobs),
  };
}
