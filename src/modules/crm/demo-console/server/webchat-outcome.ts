import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoSessionRow } from "@/modules/crm/demo-console/server/session-guard";
import type { DemoWebchatScenarioKey } from "@/modules/crm/demo-console/webchat-scenarios";
import { normaliseUkMobileToE164 } from "@/modules/crm/demo-console/normalise-uk-mobile";

type Row = Record<string, unknown>;

export type DemoWebchatOutcome = {
  complete: boolean;
  summary: string;
  missing: string[];
  counts: {
    customers: number;
    leads: number;
    jobs: number;
    appointments: number;
  };
};

function pickString(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizePhone(value: string | null) {
  if (!value) return null;
  const normalized = normaliseUkMobileToE164(value).replace(/[^\d+]/g, "");
  return normalized.length > 0 ? normalized : null;
}

function normalizeName(value: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || null;
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function hasScenarioTag(row: Row, scenarioKey: DemoWebchatScenarioKey) {
  return row.is_test === true || row.is_demo === true || row.demo_scenario_key === scenarioKey;
}

function isBookedJob(row: Row) {
  const status = pickString(row, "status")?.toLowerCase();
  return Boolean(status && ["booked", "scheduled", "in_progress", "completed"].includes(status));
}

function isSurveyJob(row: Row) {
  const visitClassification = pickString(row, "visit_classification")?.toLowerCase();
  const commercialStage = pickString(row, "commercial_stage")?.toLowerCase();
  const title = pickString(row, "title")?.toLowerCase() ?? "";
  return (
    visitClassification === "survey_assessment" ||
    commercialStage === "survey_booked" ||
    title.includes("survey")
  );
}

function isScheduledAppointment(row: Row) {
  const status = pickString(row, "status")?.toLowerCase();
  return Boolean(status && ["scheduled", "confirmed", "booked"].includes(status));
}

function isSurveyAppointment(row: Row) {
  const visitClassification = pickString(row, "visit_classification")?.toLowerCase();
  const type = pickString(row, "type")?.toLowerCase();
  const title = pickString(row, "title")?.toLowerCase() ?? "";
  return (
    visitClassification === "survey_assessment" ||
    type === "survey" ||
    title.includes("survey")
  );
}

export function buildDemoWebchatOutcome(input: {
  scenarioKey: DemoWebchatScenarioKey;
  prospectName: string;
  prospectPhone: string;
  customers: Row[];
  leads: Row[];
  jobs: Row[];
  appointments: Row[];
}): DemoWebchatOutcome {
  const phone = normalizePhone(input.prospectPhone);
  const name = normalizeName(input.prospectName);
  const customerIds = unique(
    input.customers
      .filter((row) => {
        const rowPhone = normalizePhone(pickString(row, "phone"));
        const rowName = normalizeName(pickString(row, "full_name"));
        return (
          hasScenarioTag(row, input.scenarioKey) ||
          (phone && rowPhone === phone) ||
          (name && rowName === name)
        );
      })
      .map((row) => pickString(row, "id")),
  );
  const leadIds = unique(
    input.leads
      .filter((row) => {
        const customerId = pickString(row, "customer_id");
        return hasScenarioTag(row, input.scenarioKey) || (customerId && customerIds.includes(customerId));
      })
      .map((row) => pickString(row, "id")),
  );
  const jobs = input.jobs.filter((row) => {
    const customerId = pickString(row, "customer_id");
    const leadId = pickString(row, "lead_id");
    return (
      hasScenarioTag(row, input.scenarioKey) ||
      (customerId && customerIds.includes(customerId)) ||
      (leadId && leadIds.includes(leadId))
    );
  });
  const jobIds = unique(jobs.map((row) => pickString(row, "id")));
  const appointments = input.appointments.filter((row) => {
    const customerId = pickString(row, "customer_id");
    const leadId = pickString(row, "lead_id");
    const jobId = pickString(row, "job_id");
    return (
      hasScenarioTag(row, input.scenarioKey) ||
      (customerId && customerIds.includes(customerId)) ||
      (leadId && leadIds.includes(leadId)) ||
      (jobId && jobIds.includes(jobId))
    );
  });

  const hasCustomer = customerIds.length > 0;
  const hasLead = leadIds.length > 0;
  const hasBookedJob = jobs.some(isBookedJob);
  const hasAppointment = appointments.some(isScheduledAppointment);
  const requiresSurvey = input.scenarioKey === "boiler_install_survey";
  const hasSurveyJob = jobs.some((row) => isBookedJob(row) && isSurveyJob(row));
  const hasSurveyAppointment = appointments.some(
    (row) => isScheduledAppointment(row) && isSurveyAppointment(row),
  );

  const missing: string[] = [];
  if (!hasCustomer) missing.push("customer");
  if (!hasLead) missing.push("lead");
  if (requiresSurvey) {
    if (!hasSurveyJob) missing.push("survey job");
    if (!hasSurveyAppointment) missing.push("survey appointment");
  } else {
    if (!hasBookedJob) missing.push("booked job");
    if (!hasAppointment) missing.push("appointment");
  }

  return {
    complete: missing.length === 0,
    summary:
      missing.length === 0
        ? requiresSurvey
          ? "Survey booking is visible in CRM."
          : "Booked job and appointment are visible in CRM."
        : `Waiting for ${missing.join(", ")}.`,
    missing,
    counts: {
      customers: customerIds.length,
      leads: leadIds.length,
      jobs: jobs.length,
      appointments: appointments.length,
    },
  };
}

async function listRecent(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  sessionStartedAt: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from(table)
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", sessionStartedAt)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Row[];
}

export async function getDemoWebchatOutcome(input: {
  supabase: SupabaseClient;
  tenantId: string;
  session: DemoSessionRow;
  scenarioKey: DemoWebchatScenarioKey;
}) {
  const [customers, leads, jobs, appointments] = await Promise.all([
    listRecent(input.supabase, "customers", input.tenantId, input.session.started_at),
    listRecent(input.supabase, "leads", input.tenantId, input.session.started_at),
    listRecent(input.supabase, "jobs", input.tenantId, input.session.started_at),
    listRecent(input.supabase, "appointments", input.tenantId, input.session.started_at),
  ]);

  return buildDemoWebchatOutcome({
    scenarioKey: input.scenarioKey,
    prospectName: input.session.prospect_name,
    prospectPhone: input.session.prospect_phone,
    customers,
    leads,
    jobs,
    appointments,
  });
}
