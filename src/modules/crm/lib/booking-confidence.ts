import type { LeadWithRelations } from "@/modules/crm/types";

export type BookingConfidenceLevel = "ready" | "needs_info" | "risky";

export type BookingConfidenceCheck = {
  label: string;
  state: "ok" | "missing" | "warning";
  detail: string;
};

export type BookingConfidence = {
  level: BookingConfidenceLevel;
  label: string;
  summary: string;
  checks: BookingConfidenceCheck[];
  suggestedWindows: string[];
};

export function buildBookingConfidence(
  lead: LeadWithRelations,
  options: {
    engineerCount: number;
    now?: Date;
  },
): BookingConfidence {
  const hasCustomer = Boolean(lead.customer_id);
  const hasContact = Boolean(lead.customer?.phone || lead.customer?.email);
  const hasAddress = Boolean(lead.customer?.postcode || lead.customer?.address_line1);
  const postcodeDistrict = extractPostcodeDistrict(lead.customer?.postcode ?? null);
  const hasProblem = Boolean(lead.problem_description?.trim() || lead.notes?.trim());
  const hasWorkType = Boolean(lead.service_id || lead.job_type_id || lead.service?.name || lead.job_type?.name);
  const hasTimingHint = Boolean(lead.preferred_date_text || lead.preferred_time_window || lead.next_action_at);
  const hasOwner = Boolean(lead.assigned_to || lead.owner?.full_name);
  const urgency = lead.urgency_level?.replace(/_/g, " ") ?? null;
  const duplicateWarning = lead.customer_match_result === "possible_duplicate";
  const hasEngineers = options.engineerCount > 0;
  const suggestedWindows = buildSuggestedWindows(lead, options.now ?? new Date());

  const checks: BookingConfidenceCheck[] = [
    {
      label: "Customer",
      state: hasCustomer ? "ok" : "missing",
      detail: hasCustomer ? "Customer is linked." : "Link or create a customer before booking.",
    },
    {
      label: "Contact",
      state: hasContact ? "ok" : "missing",
      detail: hasContact ? "Phone or email is available." : "Add a phone or email before confirming.",
    },
    {
      label: "Address",
      state: hasAddress ? "ok" : "warning",
      detail: hasAddress ? "Address or postcode is available." : "Confirm the job address or postcode.",
    },
    {
      label: "Area",
      state: postcodeDistrict ? "ok" : "warning",
      detail: postcodeDistrict ? `${postcodeDistrict} captured. Confirm route fit in the scheduler.` : "Add postcode so the office can check travel fit.",
    },
    {
      label: "Problem",
      state: hasProblem ? "ok" : "missing",
      detail: hasProblem ? "Problem summary is captured." : "Write what the customer needs.",
    },
    {
      label: "Work type",
      state: hasWorkType ? "ok" : "warning",
      detail: hasWorkType ? "Service or job type is selected." : "Select service and job type if known.",
    },
    {
      label: "Timing",
      state: hasTimingHint ? "ok" : "warning",
      detail: hasTimingHint ? "Customer timing preference is captured." : "Ask when the customer prefers the visit.",
    },
    {
      label: "Engineer",
      state: hasEngineers ? "ok" : "warning",
      detail: hasEngineers
        ? `${options.engineerCount} active engineer${options.engineerCount === 1 ? "" : "s"} available to select.`
        : "No active engineers are available in this view.",
    },
    {
      label: "Owner",
      state: hasOwner ? "ok" : "warning",
      detail: hasOwner ? "An office owner is set." : "Claim or assign this before confirming the booking.",
    },
  ];

  if (lead.urgency_level === "emergency" || lead.urgency_level === "same_day") {
    checks.push({
      label: "Urgency",
      state: hasTimingHint ? "ok" : "warning",
      detail: hasTimingHint
        ? `${urgency ? capitalise(urgency) : "Urgent"} timing is captured.`
        : "Urgent enquiry: agree the first safe window before booking.",
    });
  }

  if (duplicateWarning) {
    checks.unshift({
      label: "Duplicate",
      state: "warning",
      detail: "Possible duplicate customer needs checking before booking.",
    });
  }

  const missingCount = checks.filter((check) => check.state === "missing").length;
  const warningCount = checks.filter((check) => check.state === "warning").length;

  if (duplicateWarning || missingCount > 0) {
    return {
      level: "risky",
      label: "Needs checking",
      summary: "Do not confirm until the missing customer, contact, or problem details are fixed.",
      checks,
      suggestedWindows,
    };
  }

  if (warningCount > 0) {
    return {
      level: "needs_info",
      label: "Almost ready",
      summary: "Booking is possible, but confirm the warnings so the engineer gets a clean job.",
      checks,
      suggestedWindows,
    };
  }

  return {
    level: "ready",
    label: "Ready to book",
    summary: "The key customer, contact, job, and engineer details are available.",
    checks,
    suggestedWindows,
  };
}

function extractPostcodeDistrict(postcode: string | null) {
  const normalized = postcode?.trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }
  const outward = normalized.split(" ")[0];
  return outward || null;
}

function buildSuggestedWindows(lead: LeadWithRelations, now: Date) {
  const preferredDate = lead.preferred_date_text?.trim();
  const preferredWindow = lead.preferred_time_window?.trim();
  if (preferredDate && preferredWindow) {
    return [`${preferredDate}, ${preferredWindow}`, `Next available engineer after ${preferredDate}`];
  }
  if (preferredDate) {
    return [`${preferredDate}, first available`, `${preferredDate}, late morning`];
  }
  if (preferredWindow) {
    return [`Next working day, ${preferredWindow}`, `Following working day, ${preferredWindow}`];
  }
  if (lead.urgency_level === "emergency" || lead.urgency_level === "same_day") {
    return ["Today, first available engineer", "Tomorrow morning backup"];
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const following = new Date(now);
  following.setDate(following.getDate() + 2);
  return [`${formatShortDate(tomorrow)}, AM`, `${formatShortDate(following)}, PM`];
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
