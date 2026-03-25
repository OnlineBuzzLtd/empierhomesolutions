export const crmDemoCookieName = "crm_demo_mode";
export const crmDemoScenarioKey = "core-walkthrough" as const;

export type DemoScenarioKey = typeof crmDemoScenarioKey;
export type CrmMode = "live" | "demo";

export type DemoStep = {
  route: string;
  openRoute?: string;
  title: string;
  description: string;
  targetAnchor: string;
  nextHint?: string | null;
  playback: DemoPlayback;
};

export type DemoPlaybackField = {
  label: string;
  value: string;
  kind?: "text" | "textarea" | "pill";
};

export type DemoPlaybackArtifact = {
  label: string;
  detail: string;
  tone?: "slate" | "blue" | "emerald" | "amber";
};

export type DemoPlayback = {
  headline: string;
  summary: string;
  fields: DemoPlaybackField[];
  artifacts: DemoPlaybackArtifact[];
  outcomes?: string[];
};

export type CrmDemoState = {
  active: boolean;
  mode: CrmMode;
  scenarioKey: DemoScenarioKey | null;
  locked: boolean;
  pathname: string;
  steps: DemoStep[];
  currentStepIndex: number;
  currentStep: DemoStep | null;
};

export const crmDemoSteps: DemoStep[] = [
  {
    route: "/dashboard",
    title: "Dashboard",
    description: "Shows the live headline view of workload, jobs due today, unpaid invoices, and recent customer activity.",
    targetAnchor: "dashboard-overview",
    nextHint: "Then move into the pipeline to explain how new work first enters the CRM.",
    playback: {
      headline: "The day starts with a live workload snapshot",
      summary: "The replay surfaces the open workload, today's installs, unpaid balance, and the customer record that the rest of the walkthrough will use.",
      fields: [
        { label: "Open jobs", value: "3 active jobs", kind: "pill" },
        { label: "Today's installs", value: "1 boiler install at 09:00", kind: "pill" },
        { label: "Unpaid balance", value: "GBP 1,860 awaiting payment", kind: "pill" },
        { label: "Open leads", value: "1 hot enquiry due follow-up", kind: "pill" },
      ],
      artifacts: [
        { label: "Recent customer", detail: "Sarah Thompson appears with full address and active boiler record.", tone: "blue" },
        { label: "Job card", detail: "The install job is visible immediately with engineer assignment and schedule.", tone: "emerald" },
      ],
      outcomes: ["Management sees the whole pipeline before opening a single record."],
    },
  },
  {
    route: "/leads",
    title: "Leads",
    description: "Tracks incoming enquiries, ownership, source, status, and next follow-up actions before work becomes an active job.",
    targetAnchor: "lead-pipeline",
    nextHint: "Then show how leads convert into real customer records and job history.",
    playback: {
      headline: "A new enquiry is typed into the CRM in front of the viewer",
      summary: "This step should feel like a coordinator filling the lead form live, assigning an owner, and setting the next follow-up.",
      fields: [
        { label: "Status", value: "follow_up", kind: "pill" },
        { label: "Source", value: "Google Ads", kind: "text" },
        { label: "Service", value: "Boiler Install", kind: "pill" },
        { label: "Job type", value: "Installation Survey", kind: "pill" },
        { label: "Owner", value: "Shaz Iqbal", kind: "pill" },
        { label: "Next action", value: "24 Mar 2026, 10:30", kind: "text" },
        { label: "Notes", value: "Wants a combi replacement before Friday. Existing boiler is leaking and pressure keeps dropping.", kind: "textarea" },
      ],
      artifacts: [
        { label: "Lead created", detail: "Sarah Thompson lands in the pipeline with a visible follow-up badge.", tone: "blue" },
        { label: "Reminder queued", detail: "A callback reminder is scheduled so nobody misses the next action.", tone: "amber" },
      ],
      outcomes: ["The demo shows how raw demand becomes a tracked sales opportunity."],
    },
  },
  {
    route: "/customers",
    title: "Customers",
    description: "Holds customer identity, contact details, property context, linked jobs, notes, assets, and supporting documents.",
    targetAnchor: "customer-record",
    nextHint: "Then open the jobs area to show active operational delivery.",
    playback: {
      headline: "The lead is converted into a complete customer record",
      summary: "The replay fills in the homeowner profile, address, asset details, and compliance paperwork that engineers need before they attend.",
      fields: [
        { label: "Customer", value: "Sarah Thompson", kind: "text" },
        { label: "Phone", value: "07700 900123", kind: "text" },
        { label: "Email", value: "sarah.thompson@example.com", kind: "text" },
        { label: "Address", value: "18 Ash Grove, Leicester, LE5 2AB", kind: "textarea" },
        { label: "Boiler", value: "Ideal Logic C30", kind: "pill" },
        { label: "Serial", value: "IGC30-458221", kind: "text" },
      ],
      artifacts: [
        { label: "Asset linked", detail: "The boiler asset is attached with service due and warranty dates.", tone: "blue" },
        { label: "Customer note", detail: "Access note saved: side gate unlocked, dog kept inside kitchen.", tone: "slate" },
        { label: "Attachment added", detail: "Existing install photo and warranty document appear in the file list.", tone: "emerald" },
      ],
      outcomes: ["The customer record becomes the single place for contact, property, and history."],
    },
  },
  {
    route: "/jobs",
    title: "Jobs",
    description: "Manages scheduled work, job status, engineer assignment, notes, expenses, payments, and linked commercial records.",
    targetAnchor: "job-record",
    nextHint: "Then show the calendar so staff can see upcoming appointments and reminders in one view.",
    playback: {
      headline: "The operational job is built out live",
      summary: "The walkthrough should visibly assign an engineer, set the visit slot, and surface everything the team logs against the job once work starts.",
      fields: [
        { label: "Job title", value: "Boiler installation and flue upgrade", kind: "text" },
        { label: "Status", value: "booked", kind: "pill" },
        { label: "Engineer", value: "Chris Rahman", kind: "pill" },
        { label: "Scheduled date", value: "25 Mar 2026", kind: "text" },
        { label: "Scheduled time", value: "09:00", kind: "text" },
        { label: "Site notes", value: "Parking available on driveway. Power flush required before commissioning.", kind: "textarea" },
      ],
      artifacts: [
        { label: "Engineer note", detail: "Arrival note logged with photos of the existing boiler cupboard.", tone: "slate" },
        { label: "Expense logged", detail: "Materials expense added for flue kit and magnetic filter.", tone: "amber" },
        { label: "Payment recorded", detail: "Customer deposit of GBP 250 is shown against the linked job.", tone: "blue" },
        { label: "Certificate attached", detail: "Gas Safe completion certificate is added to the attachment area.", tone: "emerald" },
      ],
      outcomes: ["One job screen carries operations, notes, money, and documentation together."],
    },
  },
  {
    route: "/calendar",
    title: "Calendar",
    description: "Displays upcoming calls, surveys, bookings, recurring reminders, service due dates, and warranty prompts.",
    targetAnchor: "calendar-schedule",
    nextHint: "Then move into quoting to show how work is priced from templates and products.",
    playback: {
      headline: "Scheduling and reminders stack up in one planner",
      summary: "This replay shows the survey booking, the engineer visit, and the automatic reminder items that the CRM generates around them.",
      fields: [
        { label: "Appointment type", value: "installation survey", kind: "pill" },
        { label: "Owner", value: "Chris Rahman", kind: "pill" },
        { label: "Starts", value: "25 Mar 2026, 09:00", kind: "text" },
        { label: "Ends", value: "25 Mar 2026, 12:00", kind: "text" },
      ],
      artifacts: [
        { label: "Follow-up reminder", detail: "A callback reminder appears for the sales owner 24 hours later.", tone: "amber" },
        { label: "Service reminder", detail: "The boiler service due prompt is shown as a future recurring item.", tone: "blue" },
        { label: "Warranty prompt", detail: "The warranty expiry reminder is visible without creating real work.", tone: "emerald" },
      ],
      outcomes: ["Calendar view proves the CRM is not just records, it also drives timing."],
    },
  },
  {
    route: "/quotes",
    title: "Quotes",
    description: "Builds customer quotes from templates and catalog items, with pricing, VAT, optional extras, and PDF output.",
    targetAnchor: "quote-record",
    nextHint: "Then show invoices and how accepted quotes become billed work.",
    playback: {
      headline: "The quote is assembled from reusable commercial building blocks",
      summary: "The viewer should see a template selected, line items filled, extras suggested, and the finished commercial total appear.",
      fields: [
        { label: "Template", value: "Combi swap standard install", kind: "pill" },
        { label: "Primary line", value: "Boiler supply and install x1 at GBP 2,650", kind: "textarea" },
        { label: "Optional extra", value: "Magnetic filter x1 at GBP 180", kind: "textarea" },
        { label: "Deposit terms", value: "25 percent on booking", kind: "text" },
        { label: "Quote total", value: "GBP 3,396 including VAT", kind: "pill" },
      ],
      artifacts: [
        { label: "Template inserted", detail: "Standard labour, flue kit, and commissioning lines appear together.", tone: "blue" },
        { label: "PDF ready", detail: "The branded PDF output is available without editing the live dataset.", tone: "emerald" },
      ],
      outcomes: ["Sales can show repeatable quoting instead of manually retyping every price."],
    },
  },
  {
    route: "/invoices",
    title: "Invoices",
    description: "Tracks issued invoices, payment status, due dates, totals, and linked customer/job records.",
    targetAnchor: "invoice-record",
    nextHint: "Then open staff to show internal team records and certification tracking.",
    playback: {
      headline: "Accepted work becomes an invoice with payment tracking",
      summary: "This stage demonstrates the billing handoff, the unpaid status, and then the payment evidence being attached back to the invoice.",
      fields: [
        { label: "Invoice", value: "INV-2026-0042", kind: "text" },
        { label: "Due date", value: "01 Apr 2026", kind: "text" },
        { label: "Status", value: "unpaid", kind: "pill" },
        { label: "Total", value: "GBP 3,396", kind: "pill" },
        { label: "Payment method", value: "Card terminal", kind: "pill" },
      ],
      artifacts: [
        { label: "Payment logged", detail: "A receipt payment is recorded against the invoice history.", tone: "blue" },
        { label: "Attachment added", detail: "Receipt copy and signed completion photo appear in the invoice files.", tone: "emerald" },
        { label: "Status movement", detail: "The invoice is ready to flip from unpaid to paid in the live workflow.", tone: "amber" },
      ],
      outcomes: ["The finance step stays tied to the job and customer context."],
    },
  },
  {
    route: "/staff",
    title: "Staff",
    description: "Keeps internal staff profiles, roles, contract/pay notes, and certification expiry records in one place.",
    targetAnchor: "staff-directory",
    nextHint: "Then open reports to show management KPIs.",
    playback: {
      headline: "Engineer records and compliance documents are demonstrated live",
      summary: "This is where the demo needs to prove that staff profiles are not static contacts, they also hold certification tracking and expiry reminders.",
      fields: [
        { label: "Engineer", value: "Chris Rahman", kind: "text" },
        { label: "Role", value: "engineer", kind: "pill" },
        { label: "Pay type", value: "day rate", kind: "pill" },
        { label: "Hours", value: "40 hours per week", kind: "text" },
        { label: "Pay notes", value: "On-call supplement applies to weekend emergency work.", kind: "textarea" },
      ],
      artifacts: [
        { label: "Certification added", detail: "Gas Safe registration appears with issue and expiry dates.", tone: "emerald" },
        { label: "Certification added", detail: "Asbestos awareness training record is attached to the engineer profile.", tone: "blue" },
        { label: "Expiry reminder", detail: "A 30-day renewal reminder is visible against the compliance record.", tone: "amber" },
      ],
      outcomes: ["Managers can show compliance tracking, not just names and phone numbers."],
    },
  },
  {
    route: "/reports",
    title: "Reports",
    description: "Summarises revenue, unpaid value, lead conversion, completed jobs, profit estimate, and engineer workload.",
    targetAnchor: "reports-kpis",
    nextHint: "Then finish in settings to explain how services, templates, and rules are configured.",
    playback: {
      headline: "Management KPIs are assembled from the same live CRM records",
      summary: "The replay demonstrates how revenue, unpaid value, conversion, completion, and workload all roll up from the underlying demo dataset.",
      fields: [
        { label: "Revenue", value: "GBP 3,396", kind: "pill" },
        { label: "Unpaid", value: "GBP 1,860", kind: "pill" },
        { label: "Lead conversion", value: "1 converted from 1 lead", kind: "pill" },
        { label: "Completed jobs", value: "1 completed from 1 scheduled", kind: "pill" },
      ],
      artifacts: [
        { label: "Engineer workload", detail: "Chris Rahman shows one total job, one scheduled visit, and one completion path.", tone: "blue" },
        { label: "Profit estimate", detail: "Revenue less material expense is surfaced immediately for management.", tone: "emerald" },
      ],
      outcomes: ["The demo closes the loop by showing leadership what the pipeline produced."],
    },
  },
  {
    route: "/settings",
    title: "Settings",
    description: "Controls CRM configuration such as user roles, services, job types, custom fields, required documents, products, and templates.",
    targetAnchor: "settings-config",
    nextHint: "That completes the core walkthrough.",
    playback: {
      headline: "The final step shows what powers the workflow behind the scenes",
      summary: "The replay fills supplier, product, template, and compliance-rule details so the viewer understands that the CRM is configurable rather than hard coded.",
      fields: [
        { label: "Supplier", value: "City Plumbing", kind: "text" },
        { label: "Product", value: "Ideal Logic Max 30 boiler", kind: "text" },
        { label: "Template", value: "Combi swap standard install", kind: "pill" },
        { label: "Required document", value: "Gas Safe certificate before completion", kind: "textarea" },
      ],
      artifacts: [
        { label: "Catalog ready", detail: "Products and suppliers are available for quoting and margin control.", tone: "blue" },
        { label: "Template ready", detail: "Quote template stores line items, extras, and payment terms for reuse.", tone: "emerald" },
        { label: "Rule enforced", detail: "Compliance document requirements are visible as part of the operational setup.", tone: "amber" },
      ],
      outcomes: ["The demo ends by proving the CRM can be administered, not just used."],
    },
  },
];

export function findCrmDemoStepIndex(pathname: string) {
  return crmDemoSteps.findIndex((step) => pathname === step.route || pathname.startsWith(`${step.route}/`));
}

export function resolveCrmDemoMode(options: { cookieValue?: string | null; isDemoUser?: boolean }) {
  const locked = Boolean(options.isDemoUser);
  const active = locked || options.cookieValue === crmDemoScenarioKey;

  return {
    active,
    mode: active ? "demo" : "live",
    scenarioKey: active ? crmDemoScenarioKey : null,
    locked,
  } satisfies Pick<CrmDemoState, "active" | "mode" | "scenarioKey" | "locked">;
}

type DemoQueryable = {
  eq: (column: string, value: unknown) => unknown;
};

export function applyCrmModeFilter<TQuery extends DemoQueryable>(
  query: TQuery,
  mode: CrmMode,
  scenarioKey: DemoScenarioKey = crmDemoScenarioKey,
) {
  if (mode === "demo") {
    query.eq("is_demo", true);
    query.eq("demo_scenario_key", scenarioKey);
    return query;
  }

  query.eq("is_demo", false);
  return query;
}

export function isCrmDemoMutationBlocked(pathname: string, method: string, active: boolean) {
  if (!active) {
    return false;
  }

  if (!pathname.startsWith("/api/crm/")) {
    return false;
  }

  if (!["POST", "PATCH", "DELETE", "PUT"].includes(method.toUpperCase())) {
    return false;
  }

  return pathname !== "/api/crm/demo/start" && pathname !== "/api/crm/demo/stop";
}

export function getCrmDemoEmptyMessage(featureLabel: string) {
  return `Demo data for ${featureLabel} is not installed yet. Run the CRM demo bootstrap and refresh this walkthrough.`;
}
