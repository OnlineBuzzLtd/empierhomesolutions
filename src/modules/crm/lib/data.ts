import { addDays, endOfDay, isAfter, parseISO, startOfDay } from "date-fns";
import { cache } from "react";
import type {
  Appointment,
  Attachment,
  CalendarItem,
  Customer,
  CustomerAsset,
  CustomerWithCounts,
  CustomFieldDefinition,
  DashboardData,
  EngineerDashboardData,
  EngineerDashboardJob,
  Expense,
  Invoice,
  InvoiceSchedule,
  InvoiceWithRelations,
  JobAssignee,
  JobCertificate,
  JobChecklist,
  JobComplianceCloseout,
  JobCoolingOffConsent,
  JobHazard,
  JobPhase,
  JobSurveyAssessment,
  JobType,
  JobVariation,
  JobWithRelations,
  LeadWithRelations,
  Note,
  Payment,
  Product,
  PurchaseOrder,
  Quote,
  QuoteAcceptance,
  QuoteStatus,
  QuoteTemplate,
  QuoteVersion,
  QuoteWithRelations,
  ReportsSummary,
  RequiredDocumentRule,
  Service,
  Site,
  SiteContact,
  StaffDirectoryEntry,
  Supplier,
  SupplierReconciliation,
  UserCertification,
  UserProfile,
} from "@/modules/crm/types";
import { createCrmServerClient, createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { applyCrmModeFilter, crmDemoScenarioKey } from "@/modules/crm/lib/demo";
import { runCrmList, runCrmListStrict, runCrmSingle } from "@/modules/crm/lib/data-runner";
import { getCrmEnv } from "@/modules/crm/lib/env";
import {
  buildAssetReminderItems,
  buildCustomerPromiseCalendarItem,
  buildLeadFollowUpItem,
  expandAppointmentOccurrences,
} from "@/modules/crm/lib/calendar";
import { listCustomerPromisesForCalendar } from "@/modules/crm/lib/customer-promises";
import { summarizeEngineerDashboardJobs } from "@/modules/crm/lib/dashboard";
import { buildReportsSummary } from "@/modules/crm/lib/reporting";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import type { CrmMode } from "@/modules/crm/lib/demo";
import {
  applyCrmPagination,
  measureCrmQuery,
  type CrmPaginationInput,
} from "@/modules/crm/lib/performance";
import {
  findCustomerMatchCandidates,
  normalizeMatchEmail,
  normalizeMatchPhone,
  normalizeMatchPostcode,
  type CustomerMatchInput,
} from "@/modules/crm/lib/customer-match";

/**
 * Decides which CRM route the Calendar "Open" button should open for an
 * appointment row. We prefer the most specific linked entity because a job
 * detail page is more useful than a calendar re-load, and the leads inbox is
 * more useful than a dead-end.
 *
 * Exported so the ordering/fallback logic can be unit-tested without wiring a
 * Supabase fixture for listAppointmentsForCalendar.
 */
export function deriveAppointmentEntityLink(appointment: {
  job_id: string | null;
  customer_id: string | null;
  customer?: { id: string } | null;
  lead_id: string | null;
  lead?: { id: string } | null;
}): string {
  if (appointment.job_id) {
    return `/jobs/${appointment.job_id}`;
  }
  const customerId = appointment.customer?.id ?? appointment.customer_id;
  if (customerId) {
    return `/customers/${customerId}`;
  }
  if (appointment.lead?.id ?? appointment.lead_id) {
    return "/leads";
  }
  return "/calendar";
}

const getCachedCrmDemoState = cache(getCrmDemoState);
export const enquiryTodoStatuses = ["new", "contacted", "follow_up"] as const;
export const enquiryDoneStatuses = ["booked", "quoted", "accepted", "completed", "lost"] as const;
export type EnquiryTab = "todo" | "done" | "all";
const leadWithRelationsSelect =
  "id, tenant_id, customer_id, possible_duplicate_customer_id, service_id, job_type_id, assigned_to, status, source, source_enum, next_action_at, notes, problem_description, affected_area, urgency_level, preferred_date_text, preferred_time_window, intake_source, dedupe_result, submission_count, customer_match_result, is_demo, demo_scenario_key, created_at, updated_at, customer:customers!leads_customer_id_fkey(id, full_name, phone, email, address_line1, postcode), possible_duplicate_customer:customers!leads_possible_duplicate_customer_id_fkey(id, full_name, phone, email), service:services(id, name), job_type:job_types(id, name)";

function emptyDashboard(): DashboardData {
  return {
    openJobsCount: 0,
    todaysJobs: [],
    unpaidInvoicesTotal: 0,
    newLeadCount: 0,
    followUpDueCount: 0,
    aiReceptionistReviewCount: 0,
    recentCustomers: [],
    activeJobs: [],
  };
}

function emptyReportsSummary(): ReportsSummary {
  return {
    totalRevenue: 0,
    unpaidRevenue: 0,
    invoiceCount: 0,
    paidInvoiceCount: 0,
    leadCount: 0,
    convertedLeadCount: 0,
    jobCount: 0,
    completedJobCount: 0,
    totalExpenses: 0,
    profitEstimate: 0,
    engineerWorkload: [],
  };
}

function emptyEngineerDashboard(): EngineerDashboardData {
  return {
    nextAssignedJob: null,
    todaysAssignedJobs: [],
    overdueAssignedJobs: [],
    readyJobs: [],
    upcomingAssignedJobs: [],
    completedAssignedJobs: [],
    fieldTaskCounts: {
      missingNotes: 0,
      missingPhotos: 0,
      missingRequiredDocuments: 0,
      overdueJobs: 0,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = Number(record[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function parseDashboardSummary(value: unknown): Pick<
  DashboardData,
  "openJobsCount" | "unpaidInvoicesTotal" | "newLeadCount"
> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    openJobsCount: numberField(value, "openJobsCount"),
    unpaidInvoicesTotal: numberField(value, "unpaidInvoicesTotal"),
    newLeadCount: numberField(value, "newLeadCount"),
  };
}

function parseReportsSummary(value: unknown): ReportsSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const engineerWorkload = Array.isArray(value.engineerWorkload)
    ? value.engineerWorkload.filter(isRecord).map((entry) => ({
        engineer: String(entry.engineer ?? "Unassigned"),
        totalJobs: numberField(entry, "totalJobs"),
        completedJobs: numberField(entry, "completedJobs"),
        openJobs: numberField(entry, "openJobs"),
      }))
    : [];

  return {
    totalRevenue: numberField(value, "totalRevenue"),
    unpaidRevenue: numberField(value, "unpaidRevenue"),
    invoiceCount: numberField(value, "invoiceCount"),
    paidInvoiceCount: numberField(value, "paidInvoiceCount"),
    leadCount: numberField(value, "leadCount"),
    convertedLeadCount: numberField(value, "convertedLeadCount"),
    jobCount: numberField(value, "jobCount"),
    completedJobCount: numberField(value, "completedJobCount"),
    totalExpenses: numberField(value, "totalExpenses"),
    profitEstimate: numberField(value, "profitEstimate"),
    engineerWorkload,
  };
}

async function getCrmModeContext(mode?: CrmMode) {
  if (mode) {
    return { mode, scenarioKey: crmDemoScenarioKey };
  }

  const demoState = await getCachedCrmDemoState();
  return {
    mode: demoState.mode,
    scenarioKey: demoState.scenarioKey ?? crmDemoScenarioKey,
  };
}

type ModeQueryable = {
  eq: (column: string, value: unknown) => unknown;
};

function filterByMode(query: ModeQueryable, mode: CrmMode, scenarioKey = crmDemoScenarioKey) {
  applyCrmModeFilter(query as ModeQueryable, mode, scenarioKey);
}

async function listJobAssigneesByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobAssignee[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const assigneesQuery = supabase
    .schema("crm")
    .from("job_assignees")
    .select("*, user_profile:user_profiles(id, user_id, full_name, role)")
    .in("job_id", jobIds)
    .order("created_at", { ascending: true });
  filterByMode(assigneesQuery, context.mode, context.scenarioKey);
  const { data } = await assigneesQuery;

  const assigneesByJobId = new Map<string, JobAssignee[]>();
  for (const assignee of (data ?? []) as JobAssignee[]) {
    const current = assigneesByJobId.get(assignee.job_id) ?? [];
    current.push(assignee);
    assigneesByJobId.set(assignee.job_id, current);
  }

  return assigneesByJobId;
}

async function listJobPhasesByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobPhase[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const phasesQuery = supabase
    .schema("crm")
    .from("job_phases")
    .select("*")
    .in("job_id", jobIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  filterByMode(phasesQuery, context.mode, context.scenarioKey);
  const { data } = await phasesQuery;

  const phasesByJobId = new Map<string, JobPhase[]>();
  for (const phase of (data ?? []) as JobPhase[]) {
    const current = phasesByJobId.get(phase.job_id) ?? [];
    current.push(phase);
    phasesByJobId.set(phase.job_id, current);
  }

  return phasesByJobId;
}

async function listJobVariationsByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobVariation[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const variationsQuery = supabase
    .schema("crm")
    .from("job_variations")
    .select("*")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(variationsQuery, context.mode, context.scenarioKey);
  const { data } = await variationsQuery;

  const variationsByJobId = new Map<string, JobVariation[]>();
  for (const variation of (data ?? []) as JobVariation[]) {
    const current = variationsByJobId.get(variation.job_id) ?? [];
    current.push(variation);
    variationsByJobId.set(variation.job_id, current);
  }

  return variationsByJobId;
}

async function listQuoteVersionsByQuoteIds(quoteIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || quoteIds.length === 0) {
    return new Map<string, QuoteVersion[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const versionsQuery = supabase
    .schema("crm")
    .from("quote_versions")
    .select("*")
    .in("quote_id", quoteIds)
    .order("version_number", { ascending: false });
  filterByMode(versionsQuery, context.mode, context.scenarioKey);
  const { data } = await versionsQuery;

  const versionsByQuoteId = new Map<string, QuoteVersion[]>();
  for (const version of (data ?? []) as QuoteVersion[]) {
    const current = versionsByQuoteId.get(version.quote_id) ?? [];
    current.push(version);
    versionsByQuoteId.set(version.quote_id, current);
  }

  return versionsByQuoteId;
}

async function listQuoteAcceptancesByQuoteIds(quoteIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || quoteIds.length === 0) {
    return new Map<string, QuoteAcceptance>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const acceptancesQuery = supabase
    .schema("crm")
    .from("quote_acceptances")
    .select("*")
    .in("quote_id", quoteIds);
  filterByMode(acceptancesQuery, context.mode, context.scenarioKey);
  const { data } = await acceptancesQuery;

  return new Map(((data ?? []) as QuoteAcceptance[]).map((acceptance) => [acceptance.quote_id, acceptance]));
}

async function listInvoiceSchedulesByQuoteIds(quoteIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || quoteIds.length === 0) {
    return new Map<string, InvoiceSchedule[]>();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const schedulesQuery = supabase
    .schema("crm")
    .from("invoice_schedules")
    .select("*")
    .in("quote_id", quoteIds)
    .order("created_at", { ascending: true });
  filterByMode(schedulesQuery, context.mode, context.scenarioKey);
  const { data } = await schedulesQuery;

  const schedulesByQuoteId = new Map<string, InvoiceSchedule[]>();
  for (const schedule of (data ?? []) as InvoiceSchedule[]) {
    const current = schedulesByQuoteId.get(schedule.quote_id) ?? [];
    current.push(schedule);
    schedulesByQuoteId.set(schedule.quote_id, current);
  }

  return schedulesByQuoteId;
}

async function listJobHazardsByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobHazard[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("job_hazards")
    .select("*")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, JobHazard[]>();
  for (const row of (data ?? []) as JobHazard[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listJobChecklistsByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobChecklist[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("job_checklists")
    .select("*")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, JobChecklist[]>();
  for (const row of (data ?? []) as JobChecklist[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listJobCertificatesByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, JobCertificate[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("job_certificates")
    .select("*")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, JobCertificate[]>();
  for (const row of (data ?? []) as JobCertificate[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listPurchaseOrdersByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, PurchaseOrder[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("purchase_orders")
    .select("*, supplier:suppliers(id, name)")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, PurchaseOrder[]>();
  for (const row of (data ?? []) as PurchaseOrder[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

async function listSupplierReconciliationByJobIds(jobIds: string[], mode?: CrmMode) {
  if (!getCrmEnv().enabled || jobIds.length === 0) {
    return new Map<string, SupplierReconciliation[]>();
  }
  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const query = supabase
    .schema("crm")
    .from("supplier_reconciliation")
    .select("*, supplier:suppliers(id, name)")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  filterByMode(query, context.mode, context.scenarioKey);
  const { data } = await query;
  const map = new Map<string, SupplierReconciliation[]>();
  for (const row of (data ?? []) as SupplierReconciliation[]) {
    const current = map.get(row.job_id) ?? [];
    current.push(row);
    map.set(row.job_id, current);
  }
  return map;
}

export async function listUserProfiles(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as UserProfile[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const profilesQuery = supabase.schema("crm").from("user_profiles").select("*");
  filterByMode(profilesQuery, context.mode, context.scenarioKey);
  const { data } = await profilesQuery.order("full_name");
  return (data ?? []) as UserProfile[];
}

export const listServices = cache(async function listServices() {
  if (!getCrmEnv().enabled) {
    return [] as Service[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase.schema("crm").from("services").select("*").order("name");
  return (data ?? []) as Service[];
});

export const listJobTypes = cache(async function listJobTypes() {
  if (!getCrmEnv().enabled) {
    return [] as JobType[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase.schema("crm").from("job_types").select("*").order("name");
  return (data ?? []) as JobType[];
});

export const listCustomFieldDefinitions = cache(async function listCustomFieldDefinitions() {
  if (!getCrmEnv().enabled) {
    return [] as CustomFieldDefinition[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("custom_field_definitions")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  return (data ?? []) as CustomFieldDefinition[];
});

export const listRequiredDocumentRules = cache(async function listRequiredDocumentRules() {
  if (!getCrmEnv().enabled) {
    return [] as RequiredDocumentRule[];
  }

  const supabase = await createCrmServerClient();
  const { data } = await supabase
    .schema("crm")
    .from("required_document_rules")
    .select("*")
    .eq("active", true)
    .order("entity_type")
    .order("document_type");
  return (data ?? []) as RequiredDocumentRule[];
});

export async function getDashboardData(mode?: CrmMode): Promise<DashboardData> {
  if (!getCrmEnv().enabled) {
    return emptyDashboard();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const { data: summaryData, error: summaryError } = await measureCrmQuery(
    "getDashboardData.summary",
    supabase.schema("crm").rpc("dashboard_summary", {
      p_mode: context.mode,
      p_demo_scenario_key: context.scenarioKey,
    }),
  );
  const summary = summaryError ? null : parseDashboardSummary(summaryData);
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const todaysJobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select(
      "*, customer:customers(id, full_name, phone, address_line1, postcode), service:services(id, name), job_type:job_types(id, name)",
    );
  filterByMode(todaysJobsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(todaysJobsQuery);
  const activeJobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select(
      "*, customer:customers(id, full_name, phone, address_line1, postcode), service:services(id, name), job_type:job_types(id, name)",
    );
  filterByMode(activeJobsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(activeJobsQuery);
  const recentCustomersQuery = supabase.schema("crm").from("customers").select("*");
  filterByMode(recentCustomersQuery, context.mode, context.scenarioKey);

  const [todaysJobs, activeJobs, recentCustomers] = await Promise.all([
    runCrmList<JobWithRelations>(
      "getDashboardData.todaysJobs",
      todaysJobsQuery.eq("scheduled_date", todayDate).order("scheduled_time").limit(20),
    ),
    runCrmList<JobWithRelations>(
      "getDashboardData.activeJobs",
      activeJobsQuery.in("status", ["enquiry", "booked", "in_progress"]).order("scheduled_date").limit(20),
    ),
    runCrmList<Customer>(
      "getDashboardData.recentCustomers",
      recentCustomersQuery.eq("archived", false).order("created_at", { ascending: false }).limit(5),
    ),
  ]);

  if (summary) {
    return {
      ...summary,
      followUpDueCount: 0,
      aiReceptionistReviewCount: 0,
      todaysJobs,
      recentCustomers,
      activeJobs,
    };
  }

  const invoicesQuery = supabase.schema("crm").from("invoices").select("total, status");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  const leadsQuery = supabase.schema("crm").from("leads").select("id, status");
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(leadsQuery);
  const activeJobCountQuery = supabase.schema("crm").from("jobs").select("id", { count: "exact", head: true });
  filterByMode(activeJobCountQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(activeJobCountQuery);
  const [invoiceRows, leads, activeJobCountResponse] = await Promise.all([
    runCrmList<{ total: number | string | null; status: string }>("getDashboardData.invoicesFallback", invoicesQuery),
    runCrmList<{ id: string; status: string }>(
      "getDashboardData.leadsFallback",
      leadsQuery.in("status", ["new", "contacted", "follow_up"]),
    ),
    measureCrmQuery(
      "getDashboardData.activeJobCountFallback",
      activeJobCountQuery.in("status", ["enquiry", "booked", "in_progress"]),
    ),
  ]);

  return {
    openJobsCount: activeJobCountResponse.count ?? activeJobs.length,
    todaysJobs,
    unpaidInvoicesTotal: invoiceRows
      .filter((invoice) => invoice.status === "unpaid")
      .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
    newLeadCount: leads.length,
    followUpDueCount: 0,
    aiReceptionistReviewCount: 0,
    recentCustomers,
    activeJobs,
  };
}

export async function getEngineerDashboardData(
  engineerName: string,
  mode?: CrmMode,
): Promise<EngineerDashboardData> {
  if (!getCrmEnv().enabled || engineerName.trim().length === 0) {
    return emptyEngineerDashboard();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const windowStartDate = addDays(today, -30).toISOString().slice(0, 10);
  const windowEndDate = addDays(today, 60).toISOString().slice(0, 10);
  const jobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select(
      "id, tenant_id, customer_id, site_id, site_contact_id, service_id, job_type_id, lead_id, title, description, scheduled_date, scheduled_time, duration_hours, status, assigned_engineer, created_by, is_demo, demo_scenario_key, created_at, updated_at, customer:customers(id, full_name, phone, email, address_line1, postcode), site:sites(id, label, address_line1, postcode, city, access_notes, parking_notes), site_contact:site_contacts(id, full_name, phone, email, role_label), service:services(id, name), job_type:job_types(id, name)",
    );
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(jobsQuery);
  const { data: jobs } = await jobsQuery
    .eq("assigned_engineer", engineerName.trim())
    .gte("scheduled_date", windowStartDate)
    .lte("scheduled_date", windowEndDate)
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const assignedJobs = (jobs ?? []) as unknown as JobWithRelations[];
  if (assignedJobs.length === 0) {
    return emptyEngineerDashboard();
  }

  const jobIds = assignedJobs.map((job) => job.id);
  const notesQuery = supabase.schema("crm").from("notes").select("entity_id, body, created_at");
  filterByMode(notesQuery, context.mode, context.scenarioKey);
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("entity_id, file_type");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const quotesQuery = supabase.schema("crm").from("quotes").select("job_id");
  filterByMode(quotesQuery, context.mode, context.scenarioKey);
  const invoicesQuery = supabase.schema("crm").from("invoices").select("job_id");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  const rulesQuery = supabase
    .schema("crm")
    .from("required_document_rules")
    .select("*")
    .eq("entity_type", "job")
    .eq("active", true);

  const [{ data: notes }, { data: attachments }, { data: quotes }, { data: invoices }, { data: rules }] =
    await Promise.all([
      notesQuery.eq("entity_type", "job").in("entity_id", jobIds).order("created_at", { ascending: false }),
      attachmentsQuery.eq("entity_type", "job").in("entity_id", jobIds),
      quotesQuery.in("job_id", jobIds),
      invoicesQuery.in("job_id", jobIds),
      rulesQuery,
    ]);

  const latestNoteByJobId = new Map<string, EngineerDashboardJob["latestNote"]>();
  for (const note of (notes ?? []) as Array<Pick<Note, "body" | "created_at"> & { entity_id: string }>) {
    if (!latestNoteByJobId.has(note.entity_id)) {
      latestNoteByJobId.set(note.entity_id, { body: note.body, created_at: note.created_at });
    }
  }

  const attachmentsByJobId = new Map<string, string[]>();
  for (const attachment of (attachments ?? []) as Array<
    Pick<Attachment, "file_type"> & { entity_id: string }
  >) {
    const current = attachmentsByJobId.get(attachment.entity_id) ?? [];
    current.push(attachment.file_type);
    attachmentsByJobId.set(attachment.entity_id, current);
  }

  const quoteJobIds = new Set((quotes ?? []).map((quote) => quote.job_id));
  const invoiceJobIds = new Set((invoices ?? []).map((invoice) => invoice.job_id));
  const activeRules = (rules ?? []) as RequiredDocumentRule[];

  const enrichedJobs: EngineerDashboardJob[] = assignedJobs.map((job) => {
    const latestNote = latestNoteByJobId.get(job.id) ?? null;
    const attachmentTypes = attachmentsByJobId.get(job.id) ?? [];
    const availableTypes = new Set(attachmentTypes);
    const matchingRules = activeRules.filter((rule) => {
      const matchesService = !rule.service_id || rule.service_id === job.service_id;
      const matchesJobType = !rule.job_type_id || rule.job_type_id === job.job_type_id;
      const matchesStage = !rule.pipeline_stage || rule.pipeline_stage === job.status;
      return matchesService && matchesJobType && matchesStage && rule.required;
    });

    return {
      ...job,
      latestNote,
      attachmentCount: attachmentTypes.length,
      hasQuote: quoteJobIds.has(job.id),
      hasInvoice: invoiceJobIds.has(job.id),
      missingNote: latestNote === null,
      missingPhoto: !availableTypes.has("photo"),
      missingRequiredDocument: matchingRules.some((rule) => !availableTypes.has(rule.document_type)),
      overdue: Boolean(
        job.scheduled_date &&
        job.scheduled_date < todayDate &&
        ["enquiry", "booked", "in_progress"].includes(job.status),
      ),
    };
  });

  return summarizeEngineerDashboardJobs(enrichedJobs, todayDate);
}

function applyEnquiryTabFilter(query: { in: (column: string, values: readonly string[]) => unknown }, tab: EnquiryTab) {
  if (tab === "todo") {
    query.in("status", enquiryTodoStatuses);
  }
  if (tab === "done") {
    query.in("status", enquiryDoneStatuses);
  }
}

function hideDeletedRecords<T extends { is: (column: string, value: null) => T }>(query: T) {
  return query.is("record_deleted_at", null);
}

async function countEnquiriesByTab(mode: CrmMode, scenarioKey: typeof crmDemoScenarioKey, tab: EnquiryTab) {
  const supabase = await createCrmServerClient();
  const query = supabase.schema("crm").from("leads").select("id", { count: "exact", head: true });
  filterByMode(query, mode, scenarioKey);
  hideDeletedRecords(query);
  applyEnquiryTabFilter(query, tab);
  const { count, error } = await measureCrmQuery(`countEnquiriesByTab.${tab}`, query);
  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function getEnquiryCounts(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return { todoCount: 0, doneCount: 0, allCount: 0 };
  }

  const context = await getCrmModeContext(mode);
  const [todoCount, doneCount, allCount] = await Promise.all([
    countEnquiriesByTab(context.mode, context.scenarioKey, "todo"),
    countEnquiriesByTab(context.mode, context.scenarioKey, "done"),
    countEnquiriesByTab(context.mode, context.scenarioKey, "all"),
  ]);
  return { todoCount, doneCount, allCount };
}

function buildLeadsQuery(
  supabase: Awaited<ReturnType<typeof createCrmServerClient>>,
  context: { mode: CrmMode; scenarioKey: typeof crmDemoScenarioKey },
  tab: EnquiryTab,
) {
  const leadsQuery = supabase
    .schema("crm")
    .from("leads")
    .select(leadWithRelationsSelect);
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(leadsQuery);
  applyEnquiryTabFilter(leadsQuery, tab);
  return leadsQuery;
}

export async function listLeads(mode?: CrmMode, pagination?: CrmPaginationInput, tab: EnquiryTab = "all") {
  if (!getCrmEnv().enabled) {
    return [] as LeadWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const leadsQuery = buildLeadsQuery(supabase, context, tab);
  return runCrmList<LeadWithRelations>(
    "listLeads",
    applyCrmPagination(leadsQuery.order("created_at", { ascending: false }), pagination),
  );
}

export async function listLeadsStrict(mode?: CrmMode, pagination?: CrmPaginationInput, tab: EnquiryTab = "all") {
  if (!getCrmEnv().enabled) {
    return [] as LeadWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const leadsQuery = buildLeadsQuery(supabase, context, tab);
  return runCrmListStrict<LeadWithRelations>(
    "listLeads",
    applyCrmPagination(leadsQuery.order("created_at", { ascending: false }), pagination),
  );
}

export async function getLeadById(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const leadsQuery = buildLeadsQuery(supabase, context, "all");
  return runCrmSingle<LeadWithRelations>("getLeadById", leadsQuery.eq("id", id).maybeSingle());
}

export async function listCustomers(mode?: CrmMode, pagination?: CrmPaginationInput) {
  if (!getCrmEnv().enabled) {
    return [] as CustomerWithCounts[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const customersQuery = supabase
    .schema("crm")
    .from("customers")
    .select("id, tenant_id, full_name, phone, email, address_line1, postcode, archived, is_demo, demo_scenario_key, created_at, updated_at");
  filterByMode(customersQuery, context.mode, context.scenarioKey);
  const customers = await runCrmList<Customer>(
    "listCustomers.customers",
    applyCrmPagination(customersQuery.eq("archived", false).order("created_at", { ascending: false }), pagination),
  );
  const customerIds = customers.map((customer) => customer.id);
  let jobs: Array<{ customer_id: string; status: string }> = [];
  if (customerIds.length > 0) {
    const jobsQuery = supabase.schema("crm").from("jobs").select("customer_id, status");
    filterByMode(jobsQuery, context.mode, context.scenarioKey);
    jobs = await runCrmList<{ customer_id: string; status: string }>(
      "listCustomers.jobs",
      hideDeletedRecords(jobsQuery).in("customer_id", customerIds),
    );
  }

  const counts = new Map<string, { total: number; active: number }>();
  jobs.forEach((job) => {
    const entry = counts.get(job.customer_id) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (["enquiry", "booked", "in_progress"].includes(job.status)) {
      entry.active += 1;
    }
    counts.set(job.customer_id, entry);
  });

  return customers.map((customer) => {
    const count = counts.get(customer.id) ?? { total: 0, active: 0 };
    return {
      ...customer,
      job_count: count.total,
      active_job_count: count.active,
    };
  });
}

export type CustomerServerMatchCandidate = {
  customer: Customer;
  score: number;
  reasons: string[];
  activeLeadCount: number;
  activeJobCount: number;
};

export async function searchCustomerMatchCandidates(
  input: CustomerMatchInput,
  mode?: CrmMode,
  limit = 5,
): Promise<CustomerServerMatchCandidate[]> {
  if (!getCrmEnv().enabled) {
    return [];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const normalizedPhone = normalizeMatchPhone(input.phone);
  const normalizedEmail = normalizeMatchEmail(input.email);
  const normalizedPostcode = normalizeMatchPostcode(input.postcode);
  const nameTokens = String(input.fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 3);

  const filters: string[] = [];
  if (normalizedEmail) {
    filters.push(`email.ilike.%${escapeSupabaseLike(normalizedEmail)}%`);
  }
  if (normalizedPostcode) {
    filters.push(`postcode.ilike.%${escapeSupabaseLike(normalizedPostcode.slice(0, 4))}%`);
  }
  if (normalizedPhone && normalizedPhone.length >= 6) {
    filters.push(`phone.ilike.%${escapeSupabaseLike(normalizedPhone.slice(-6))}%`);
  }
  for (const token of nameTokens) {
    filters.push(`full_name.ilike.%${escapeSupabaseLike(token)}%`);
  }

  if (filters.length === 0) {
    return [];
  }

  const customersQuery = supabase
    .schema("crm")
    .from("customers")
    .select("id, tenant_id, full_name, phone, email, address_line1, address_line2, city, postcode, source, notes, archived, is_demo, demo_scenario_key, created_at, updated_at")
    .or(filters.join(","))
    .limit(50);
  filterByMode(customersQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(customersQuery);

  const customerRows = await runCrmList<Customer>(
    "searchCustomerMatchCandidates.customers",
    customersQuery.order("updated_at", { ascending: false }),
  );
  const candidates = findCustomerMatchCandidates(input, customerRows, limit);
  const customerIds = candidates.map((candidate) => candidate.customer.id);
  if (customerIds.length === 0) {
    return [];
  }

  const activeLeadStatuses = ["new", "contacted", "follow_up", "survey_booked", "quoted", "accepted", "booked"];
  const activeJobStatuses = ["enquiry", "booked", "in_progress", "no_access"];
  const leadsQuery = supabase
    .schema("crm")
    .from("leads")
    .select("customer_id, status")
    .in("customer_id", customerIds)
    .in("status", activeLeadStatuses);
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(leadsQuery);
  const jobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select("customer_id, status")
    .in("customer_id", customerIds)
    .in("status", activeJobStatuses);
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(jobsQuery);

  const [leadRows, jobRows] = await Promise.all([
    runCrmList<{ customer_id: string | null }>("searchCustomerMatchCandidates.leads", leadsQuery),
    runCrmList<{ customer_id: string | null }>("searchCustomerMatchCandidates.jobs", jobsQuery),
  ]);
  const activeLeadCounts = countByCustomerId(leadRows);
  const activeJobCounts = countByCustomerId(jobRows);

  return candidates.map((candidate) => ({
    ...candidate,
    activeLeadCount: activeLeadCounts.get(candidate.customer.id) ?? 0,
    activeJobCount: activeJobCounts.get(candidate.customer.id) ?? 0,
  }));
}

function countByCustomerId(rows: Array<{ customer_id: string | null }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.customer_id) {
      continue;
    }
    counts.set(row.customer_id, (counts.get(row.customer_id) ?? 0) + 1);
  }
  return counts;
}

function escapeSupabaseLike(value: string) {
  return value.replace(/[%_,]/g, "");
}

export async function listSites(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Array<Site & { customer?: Pick<Customer, "id" | "full_name"> | null }>;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const sitesQuery = supabase.schema("crm").from("sites").select("*, customer:customers(id, full_name)");
  filterByMode(sitesQuery, context.mode, context.scenarioKey);
  return runCrmList<Site & { customer?: Pick<Customer, "id" | "full_name"> | null }>(
    "listSites",
    sitesQuery.order("is_primary", { ascending: false }).order("label", { ascending: true }),
  );
}

export async function listSiteContacts(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Array<SiteContact & { site?: Pick<Site, "id" | "label" | "customer_id"> | null }>;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const contactsQuery = supabase
    .schema("crm")
    .from("site_contacts")
    .select("*, site:sites(id, label, customer_id)");
  filterByMode(contactsQuery, context.mode, context.scenarioKey);
  return runCrmList<SiteContact & { site?: Pick<Site, "id" | "label" | "customer_id"> | null }>(
    "listSiteContacts",
    contactsQuery.order("is_primary", { ascending: false }).order("full_name", { ascending: true }),
  );
}

export async function getCustomerDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const customerQuery = supabase.schema("crm").from("customers").select("*");
  filterByMode(customerQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(customerQuery);
  const jobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select(
      "*, customer:customers(id, full_name, phone, address_line1, postcode), site:sites(id, label, address_line1, postcode, city, access_notes, parking_notes), site_contact:site_contacts(id, full_name, phone, email, role_label), service:services(id, name), job_type:job_types(id, name)",
    );
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(jobsQuery);
  const leadsQuery = buildLeadsQuery(supabase, context, "todo");
  const notesQuery = supabase.schema("crm").from("notes").select("*");
  filterByMode(notesQuery, context.mode, context.scenarioKey);
  const assetsQuery = supabase.schema("crm").from("customer_assets").select("*");
  filterByMode(assetsQuery, context.mode, context.scenarioKey);
  const sitesQuery = supabase.schema("crm").from("sites").select("*");
  filterByMode(sitesQuery, context.mode, context.scenarioKey);
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("*");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const [
    { data: customer },
    { data: jobs },
    { data: leads },
    { data: notes },
    { data: assets },
    { data: sites },
    { data: attachments },
    { data: customFields },
  ] = await Promise.all([
    customerQuery.eq("id", id).maybeSingle(),
    jobsQuery.eq("customer_id", id).order("created_at", { ascending: false }),
    leadsQuery.eq("customer_id", id).order("next_action_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
    notesQuery.eq("entity_type", "customer").eq("entity_id", id).order("created_at", { ascending: false }),
    assetsQuery.eq("customer_id", id).order("created_at", { ascending: false }),
    sitesQuery
      .eq("customer_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false }),
    attachmentsQuery
      .eq("entity_type", "customer")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .schema("crm")
      .from("custom_field_values")
      .select("*, field_definition:custom_field_definitions(*)")
      .eq("entity_type", "customer")
      .eq("entity_id", id),
  ]);

  if (!customer) {
    return null;
  }

  const customerJobs = (jobs ?? []) as JobWithRelations[];
  const assigneesByJobId = await listJobAssigneesByJobIds(
    customerJobs.map((job) => job.id),
    context.mode,
  );
  const siteIds = ((sites ?? []) as Site[]).map((site) => site.id);
  let siteContacts: Array<SiteContact & { site?: Pick<Site, "id" | "label"> | null }> = [];
  if (siteIds.length > 0) {
    const siteContactsQuery = supabase.schema("crm").from("site_contacts").select("*, site:sites(id, label)");
    filterByMode(siteContactsQuery, context.mode, context.scenarioKey);
    const { data } = await siteContactsQuery
      .in("site_id", siteIds)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    siteContacts = (data ?? []) as Array<SiteContact & { site?: Pick<Site, "id" | "label"> | null }>;
  }

  return {
    customer: customer as Customer,
    jobs: customerJobs.map((job) => ({ ...job, assignees: assigneesByJobId.get(job.id) ?? [] })),
    leads: (leads ?? []) as unknown as LeadWithRelations[],
    notes: (notes ?? []) as Note[],
    assets: (assets ?? []) as CustomerAsset[],
    sites: (sites ?? []) as Site[],
    siteContacts,
    attachments: (attachments ?? []) as Attachment[],
    customFields: customFields ?? [],
  };
}

export async function listJobs(
  mode?: CrmMode,
  pagination?: CrmPaginationInput,
  filters?: { customerId?: string | null },
) {
  if (!getCrmEnv().enabled) {
    return [] as JobWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const jobsQuery = supabase
    .schema("crm")
    .from("jobs")
    .select(
      "id, tenant_id, customer_id, site_id, site_contact_id, service_id, job_type_id, lead_id, title, scheduled_date, scheduled_time, status, assigned_engineer, is_demo, demo_scenario_key, created_at, updated_at, customer:customers(id, full_name, phone, address_line1, postcode), site:sites(id, label), service:services(id, name), job_type:job_types(id, name)",
    );
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(jobsQuery);
  // Scoping to one customer lets callers (e.g. the quote form's job dropdown)
  // fetch that customer's jobs directly instead of paging the whole job list
  // and filtering client-side, which silently dropped jobs past the page size.
  if (filters?.customerId) {
    jobsQuery.eq("customer_id", filters.customerId);
  }
  // Jobs behave like an inbox: the top of the list should be the most recently
  // submitted booking, not "what's next on the diary" (that's the Calendar
  // page's job). Tie-break on scheduled_date so two jobs created in the same
  // instant still sort deterministically.
  const jobs = await runCrmList<JobWithRelations>(
    "listJobs",
    applyCrmPagination(
      jobsQuery
        .order("created_at", { ascending: false })
        .order("scheduled_date", { ascending: false, nullsFirst: false }),
      pagination,
    ),
  );
  return jobs.map((job) => ({
    ...job,
    assignees: [],
    phases: [],
    variations: [],
  }));
}

export async function getJobDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const jobQuery = supabase
    .schema("crm")
    .from("jobs")
    .select(
      "*, customer:customers(id, full_name, phone, email, address_line1, postcode), site:sites(id, label, address_line1, postcode, city, access_notes, parking_notes), site_contact:site_contacts(id, full_name, phone, email, role_label), service:services(id, name), job_type:job_types(id, name)",
    );
  filterByMode(jobQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(jobQuery);
  const notesQuery = supabase.schema("crm").from("notes").select("*");
  filterByMode(notesQuery, context.mode, context.scenarioKey);
  const expensesQuery = supabase.schema("crm").from("expenses").select("*");
  filterByMode(expensesQuery, context.mode, context.scenarioKey);
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("*");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const quoteQuery = supabase.schema("crm").from("quotes").select("*");
  filterByMode(quoteQuery, context.mode, context.scenarioKey);
  const invoiceQuery = supabase.schema("crm").from("invoices").select("*");
  filterByMode(invoiceQuery, context.mode, context.scenarioKey);
  const surveyAssessmentQuery = supabase.schema("crm").from("job_survey_assessments").select("*");
  const coolingOffQuery = supabase.schema("crm").from("job_cooling_off_consents").select("*");
  const complianceCloseoutQuery = supabase.schema("crm").from("job_compliance_closeouts").select("*");
  const [
    { data: job },
    { data: notes },
    { data: expenses },
    { data: attachments },
    { data: quote },
    { data: invoice },
    { data: surveyAssessment },
    { data: coolingOffConsent },
    { data: complianceCloseout },
  ] = await Promise.all([
    jobQuery.eq("id", id).maybeSingle(),
    notesQuery.eq("entity_type", "job").eq("entity_id", id).order("created_at", { ascending: false }),
    expensesQuery.eq("job_id", id).order("created_at", { ascending: false }),
    attachmentsQuery.eq("entity_type", "job").eq("entity_id", id).order("created_at", { ascending: false }),
    quoteQuery.eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    invoiceQuery.eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    surveyAssessmentQuery.eq("job_id", id).maybeSingle(),
    coolingOffQuery.eq("job_id", id).maybeSingle(),
    complianceCloseoutQuery.eq("job_id", id).maybeSingle(),
  ]);

  if (!job) {
    return null;
  }

  const [
    assigneesByJobId,
    phasesByJobId,
    variationsByJobId,
    hazardsByJobId,
    checklistsByJobId,
    certificatesByJobId,
    purchaseOrdersByJobId,
    supplierReconciliationByJobId,
  ] = await Promise.all([
    listJobAssigneesByJobIds([id], context.mode),
    listJobPhasesByJobIds([id], context.mode),
    listJobVariationsByJobIds([id], context.mode),
    listJobHazardsByJobIds([id], context.mode),
    listJobChecklistsByJobIds([id], context.mode),
    listJobCertificatesByJobIds([id], context.mode),
    listPurchaseOrdersByJobIds([id], context.mode),
    listSupplierReconciliationByJobIds([id], context.mode),
  ]);

  const paymentsQuery = supabase.schema("crm").from("payments").select("*");
  filterByMode(paymentsQuery, context.mode, context.scenarioKey);
  const { data: payments } = invoice
    ? await paymentsQuery.eq("invoice_id", invoice.id).order("created_at", { ascending: false })
    : { data: [] };

  return {
    job: {
      ...(job as JobWithRelations),
      assignees: assigneesByJobId.get(id) ?? [],
      phases: phasesByJobId.get(id) ?? [],
      variations: variationsByJobId.get(id) ?? [],
      hazards: hazardsByJobId.get(id) ?? [],
      checklists: checklistsByJobId.get(id) ?? [],
      certificates: certificatesByJobId.get(id) ?? [],
      purchaseOrders: purchaseOrdersByJobId.get(id) ?? [],
      supplierReconciliation: supplierReconciliationByJobId.get(id) ?? [],
      surveyAssessment: (surveyAssessment ?? null) as JobSurveyAssessment | null,
      coolingOffConsent: (coolingOffConsent ?? null) as JobCoolingOffConsent | null,
      complianceCloseout: (complianceCloseout ?? null) as JobComplianceCloseout | null,
    },
    notes: (notes ?? []) as Note[],
    expenses: (expenses ?? []) as Expense[],
    payments: (payments ?? []) as Payment[],
    attachments: (attachments ?? []) as Attachment[],
    quote: (quote ?? null) as Quote | null,
    invoice: (invoice ?? null) as Invoice | null,
  };
}

export async function listQuotes(
  mode?: CrmMode,
  pagination?: CrmPaginationInput,
  filters?: { status?: QuoteStatus | null },
) {
  if (!getCrmEnv().enabled) {
    return [] as QuoteWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const quotesQuery = supabase
    .schema("crm")
    .from("quotes")
    .select("id, tenant_id, job_id, customer_id, quote_number, document_type, current_version_number, status, total, valid_until, is_demo, demo_scenario_key, created_at, updated_at, customer:customers(id, full_name), job:jobs(id, title)");
  filterByMode(quotesQuery, context.mode, context.scenarioKey);
  // The Draft/Sent/Accepted/Declined tabs previously never reached the query,
  // so every tab showed the same unfiltered list.
  if (filters?.status) {
    quotesQuery.eq("status", filters.status);
  }
  return runCrmList<QuoteWithRelations>(
    "listQuotes",
    applyCrmPagination(quotesQuery.order("created_at", { ascending: false }), pagination),
  );
}

export async function getQuoteDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const quoteQuery = supabase
    .schema("crm")
    .from("quotes")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)");
  filterByMode(quoteQuery, context.mode, context.scenarioKey);
  const { data } = await quoteQuery.eq("id", id).maybeSingle();
  if (!data) {
    return null;
  }
  const [versionsByQuoteId, acceptancesByQuoteId, schedulesByQuoteId] = await Promise.all([
    listQuoteVersionsByQuoteIds([id], context.mode),
    listQuoteAcceptancesByQuoteIds([id], context.mode),
    listInvoiceSchedulesByQuoteIds([id], context.mode),
  ]);
  return {
    ...(data as QuoteWithRelations),
    versions: versionsByQuoteId.get(id) ?? [],
    acceptance: acceptancesByQuoteId.get(id) ?? null,
    invoiceSchedules: schedulesByQuoteId.get(id) ?? [],
  } satisfies QuoteWithRelations;
}

export async function listInvoices(mode?: CrmMode, pagination?: CrmPaginationInput) {
  if (!getCrmEnv().enabled) {
    return [] as InvoiceWithRelations[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const invoicesQuery = supabase
    .schema("crm")
    .from("invoices")
    .select("id, tenant_id, quote_id, job_id, customer_id, invoice_number, invoice_kind, status, total, due_date, paid_at, is_demo, demo_scenario_key, created_at, updated_at, customer:customers(id, full_name), job:jobs(id, title)");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  return runCrmList<InvoiceWithRelations>(
    "listInvoices",
    applyCrmPagination(invoicesQuery.order("created_at", { ascending: false }), pagination),
  );
}

export async function getInvoiceDetail(id: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return null;
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const invoiceQuery = supabase
    .schema("crm")
    .from("invoices")
    .select("*, customer:customers(id, full_name, address_line1, postcode, phone), job:jobs(id, title)");
  filterByMode(invoiceQuery, context.mode, context.scenarioKey);
  const paymentsQuery = supabase.schema("crm").from("payments").select("*");
  filterByMode(paymentsQuery, context.mode, context.scenarioKey);
  const [{ data: invoice }, { data: payments }] = await Promise.all([
    invoiceQuery.eq("id", id).maybeSingle(),
    paymentsQuery.eq("invoice_id", id).order("created_at", { ascending: false }),
  ]);

  if (!invoice) {
    return null;
  }

  return {
    invoice: invoice as InvoiceWithRelations,
    payments: (payments ?? []) as Payment[],
  };
}

export async function listAppointmentsForCalendar(filters?: {
  assignedTo?: string | null;
  type?: string | null;
  status?: string | null;
  days?: number;
  /**
   * Anchor date for the window. When omitted, behaviour is unchanged
   * (window is today → today + `days`). When supplied (e.g. by the
   * week-timeline nav), the window becomes [from, from + days].
   * Accepts a Date or any string Date can parse.
   */
  from?: Date | string;
  mode?: CrmMode;
}) {
  if (!getCrmEnv().enabled) {
    return [] as CalendarItem[];
  }

  const context = await getCrmModeContext(filters?.mode);
  const supabase = await createCrmServerClient();
  const days = filters?.days ?? 7;
  const anchor = filters?.from ? new Date(filters.from) : new Date();
  const start = startOfDay(anchor);
  const end = endOfDay(addDays(start, days));
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const appointmentsQuery = supabase
    .schema("crm")
    .from("appointments")
    .select("*, customer:customers(id, full_name, postcode), lead:leads(id, status, source)");
  filterByMode(appointmentsQuery, context.mode, context.scenarioKey);
  const leadsQuery = supabase
    .schema("crm")
    .from("leads")
    .select("id, status, source, assigned_to, next_action_at, customer:customers(id, full_name, postcode)");
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  const assetsQuery = supabase
    .schema("crm")
    .from("customer_assets")
    .select("*, customer:customers(id, full_name, postcode)");
  filterByMode(assetsQuery, context.mode, context.scenarioKey);
  const usersQuery = supabase.schema("crm").from("user_profiles").select("*");
  filterByMode(usersQuery, context.mode, context.scenarioKey);

  const [{ data: appointments }, { data: leads }, { data: assets }, { data: users }, customerPromises] = await Promise.all([
    appointmentsQuery
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at"),
    leadsQuery
      .not("next_action_at", "is", null)
      .gte("next_action_at", start.toISOString())
      .lte("next_action_at", end.toISOString()),
    assetsQuery
      .or(
        `and(service_due_date.gte.${startDate},service_due_date.lte.${endDate}),and(warranty_end_date.gte.${startDate},warranty_end_date.lte.${endDate})`,
      )
      .order("service_due_date", { ascending: true, nullsFirst: false }),
    usersQuery,
    listCustomerPromisesForCalendar({
      dueFrom: start.toISOString(),
      dueTo: end.toISOString(),
      mode: context.mode,
    }),
  ]);

  const usersById = new Map<string, UserProfile>(
    ((users ?? []) as UserProfile[]).map((user) => [user.user_id, user]),
  );
  const items: CalendarItem[] = [];
  const promiseLeadIds = new Set(customerPromises.map((promise) => promise.lead_id).filter((id): id is string => Boolean(id)));

  for (const appointment of (appointments ?? []) as Array<
    Appointment & { customer?: CalendarItem["customer"]; lead?: CalendarItem["lead"] }
  >) {
    const appointmentEntityLink = deriveAppointmentEntityLink({
      job_id: appointment.job_id,
      customer_id: appointment.customer_id,
      customer: appointment.customer,
      lead_id: appointment.lead_id,
      lead: appointment.lead,
    });

    for (const occurrence of expandAppointmentOccurrences(appointment, start, end)) {
      const owner = occurrence.assigned_to ? (usersById.get(occurrence.assigned_to) ?? null) : null;
      items.push({
        ...occurrence,
        source: "appointment",
        appointment_source: appointment.source ?? null,
        customer: appointment.customer ?? null,
        lead: appointment.lead ?? null,
        owner: owner ? { id: owner.id, full_name: owner.full_name, role: owner.role } : null,
        recurrence_origin_id: appointment.id,
        entity_link: appointmentEntityLink,
      });
    }
  }

  for (const lead of (leads ?? []) as unknown as Array<{
    id: string;
    status: LeadWithRelations["status"];
    source: string | null;
    assigned_to: string | null;
    next_action_at: string | null;
    customer?:
      | Array<{ id: string; full_name: string; postcode: string | null }>
      | { id: string; full_name: string; postcode: string | null }
      | null;
  }>) {
    if (!lead.next_action_at) {
      continue;
    }
    if (promiseLeadIds.has(lead.id)) {
      continue;
    }
    const customer = Array.isArray(lead.customer) ? (lead.customer[0] ?? null) : (lead.customer ?? null);
    const nextActionAt = lead.next_action_at;
    items.push(buildLeadFollowUpItem({ ...lead, customer, next_action_at: nextActionAt }, usersById));
  }

  for (const promise of customerPromises) {
    if (!promise.due_at) {
      continue;
    }
    items.push(buildCustomerPromiseCalendarItem(promise, usersById));
  }

  for (const asset of assets ?? []) {
    items.push(
      ...buildAssetReminderItems(
        asset as CustomerAsset & { customer?: CalendarItem["customer"] },
        start,
        end,
      ),
    );
  }

  return items
    .filter((item) => !isAfter(start, parseISO(item.starts_at)))
    .filter((item) => !filters?.assignedTo || item.assigned_to === filters.assignedTo)
    .filter((item) => !filters?.type || item.type === filters.type)
    .filter((item) => !filters?.status || item.status === filters.status)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function listAttachmentsForEntity(entityType: string, entityId: string, mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Attachment[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const attachmentsQuery = supabase.schema("crm").from("attachments").select("*");
  filterByMode(attachmentsQuery, context.mode, context.scenarioKey);
  const { data } = await attachmentsQuery
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Attachment[];
}

export async function createSignedAttachmentUrl(path: string) {
  const env = getCrmEnv();
  if (!env.adminEnabled) {
    return null;
  }

  const admin = createCrmServiceRoleClient();
  const { data } = await admin.storage.from("crm-uploads").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export const listStaffDirectory = cache(async function listStaffDirectory(
  mode?: CrmMode,
  // Inactive members stay out of the Team list by default so it shows the people
  // actually working. They are never deleted — deactivation is reversible and
  // preserves historic job assignments and certifications.
  includeInactive = false,
) {
  if (!getCrmEnv().enabled) {
    return [] as StaffDirectoryEntry[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const profilesQuery = supabase.schema("crm").from("user_profiles").select("*");
  filterByMode(profilesQuery, context.mode, context.scenarioKey);
  if (!includeInactive) {
    profilesQuery.eq("active", true);
  }
  const certificationsQuery = supabase.schema("crm").from("user_certifications").select("*");
  filterByMode(certificationsQuery, context.mode, context.scenarioKey);
  const [{ data: profiles }, { data: certifications }] = await Promise.all([
    profilesQuery.order("full_name"),
    certificationsQuery.order("expiry_date", { ascending: true, nullsFirst: false }),
  ]);

  const certificationsByProfile = new Map<string, UserCertification[]>();
  for (const certification of (certifications ?? []) as UserCertification[]) {
    const current = certificationsByProfile.get(certification.user_profile_id) ?? [];
    current.push(certification);
    certificationsByProfile.set(certification.user_profile_id, current);
  }

  return ((profiles ?? []) as UserProfile[]).map((profile) => ({
    ...profile,
    certifications: certificationsByProfile.get(profile.id) ?? [],
  }));
});

export async function getReportsSummary(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return emptyReportsSummary();
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const { data: summaryData, error: summaryError } = await measureCrmQuery(
    "getReportsSummary.summary",
    supabase.schema("crm").rpc("reports_summary", {
      p_mode: context.mode,
      p_demo_scenario_key: context.scenarioKey,
    }),
  );
  const summary = summaryError ? null : parseReportsSummary(summaryData);
  if (summary) {
    return summary;
  }

  const invoicesQuery = supabase.schema("crm").from("invoices").select("total, status");
  filterByMode(invoicesQuery, context.mode, context.scenarioKey);
  const leadsQuery = supabase.schema("crm").from("leads").select("status");
  filterByMode(leadsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(leadsQuery);
  const jobsQuery = supabase.schema("crm").from("jobs").select("status, assigned_engineer");
  filterByMode(jobsQuery, context.mode, context.scenarioKey);
  hideDeletedRecords(jobsQuery);
  const expensesQuery = supabase.schema("crm").from("expenses").select("amount");
  filterByMode(expensesQuery, context.mode, context.scenarioKey);
  const [{ data: invoices }, { data: leads }, { data: jobs }, { data: expenses }] = await Promise.all([
    invoicesQuery,
    leadsQuery,
    jobsQuery,
    expensesQuery,
  ]);

  return buildReportsSummary({
    invoices: (invoices ?? []) as Array<{ total: number | string | null; status: string }>,
    leads: (leads ?? []) as Array<{ status: LeadWithRelations["status"] }>,
    jobs: (jobs ?? []) as Array<{ status: JobWithRelations["status"]; assigned_engineer: string | null }>,
    expenses: (expenses ?? []) as Array<{ amount: number | string | null }>,
  });
}

export const listSuppliers = cache(async function listSuppliers(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Supplier[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const suppliersQuery = supabase.schema("crm").from("suppliers").select("*");
  filterByMode(suppliersQuery, context.mode, context.scenarioKey);
  const { data } = await suppliersQuery.order("name");
  return (data ?? []) as Supplier[];
});

export const listProducts = cache(async function listProducts(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as Product[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const productsQuery = supabase.schema("crm").from("products").select("*");
  filterByMode(productsQuery, context.mode, context.scenarioKey);
  const { data } = await productsQuery.order("name");
  return (data ?? []) as Product[];
});

export const listQuoteTemplates = cache(async function listQuoteTemplates(mode?: CrmMode) {
  if (!getCrmEnv().enabled) {
    return [] as QuoteTemplate[];
  }

  const context = await getCrmModeContext(mode);
  const supabase = await createCrmServerClient();
  const templatesQuery = supabase.schema("crm").from("quote_templates").select("*");
  filterByMode(templatesQuery, context.mode, context.scenarioKey);
  const { data } = await templatesQuery.order("name");
  return (data ?? []) as QuoteTemplate[];
});
