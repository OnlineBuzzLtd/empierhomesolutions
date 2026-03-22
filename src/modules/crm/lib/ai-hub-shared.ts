import type { AiConversation, AiRoiMetrics } from "@/modules/crm/types";

export function getAiHubScenarioDurationMs(conversation: AiConversation) {
  const lastOffsetSeconds = Math.max(
    0,
    ...conversation.messages.map((message) => message.offset_seconds),
    ...conversation.actions.map((action) => action.offset_seconds),
    ...conversation.impacts.map((impact) => impact.offset_seconds),
  );

  return (lastOffsetSeconds + 3) * 1000;
}

export function formatAiHubMetricValue(label: keyof AiRoiMetrics, value: number) {
  if (label === "average_response_minutes") {
    return `${value} min`;
  }

  return String(value);
}

export const aiHubMetricLabels: Record<keyof AiRoiMetrics, string> = {
  missed_calls_recovered: "Missed calls recovered",
  bookings_captured: "Bookings captured",
  leads_qualified: "Leads qualified",
  average_response_minutes: "Average response time",
};

export const aiHubPaidReasons = [
  "24/7 coverage for missed calls, web chat, SMS, and WhatsApp enquiries.",
  "Automatic CRM updates so the team works from live leads, customers, jobs, and commercial context.",
  "Less admin time spent chasing intake details and manually typing notes into the CRM.",
  "Faster revenue recovery because qualified opportunities are captured outside office hours.",
] as const;
