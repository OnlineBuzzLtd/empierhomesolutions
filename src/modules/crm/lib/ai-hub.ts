import type { AddonState, AiAgentAction, AiConversation, AiCrmImpact, AiMessage, AiRoiMetrics, AiScenario } from "@/modules/crm/types";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { getCrmEnv } from "@/modules/crm/lib/env";
export { aiHubMetricLabels, aiHubPaidReasons, formatAiHubMetricValue, getAiHubScenarioDurationMs } from "@/modules/crm/lib/ai-hub-shared";

type DemoAiHubConversationSeed = Omit<AiConversation, "messages" | "actions" | "impacts"> & {
  messages: Omit<AiMessage, "conversation_id">[];
  actions: Omit<AiAgentAction, "conversation_id">[];
  impacts: Omit<AiCrmImpact, "conversation_id">[];
};

export interface AiHubProvider {
  listScenarios(): Promise<AiConversation[]>;
  getAggregateMetrics(): Promise<AiRoiMetrics>;
}

const fallbackAddonPriceLabel = "From GBP 299/mo per company";

const fallbackScenarios: DemoAiHubConversationSeed[] = [
  {
    id: "44444444-4444-4444-8444-444444444401",
    scenario_key: "missed-call-recovery",
    title: "Missed Call Recovery",
    subtitle: "After-hours voice lead converted into a booked callback",
    channel: "voice",
    customer_name: "Daniel Brooks",
    customer_handle: "+44 7700 900901",
    inbound_label: "Missed call captured at 18:42",
    summary: "AI follows up a missed evening call, qualifies the leak, and books a next-morning callback without admin intervention.",
    final_outcome: "Lead created, customer matched, callback appointment booked for 08:30, escalation note sent to on-call manager.",
    roi_metrics: {
      missed_calls_recovered: 14,
      bookings_captured: 6,
      leads_qualified: 19,
      average_response_minutes: 2,
    },
    extracted_entities: {
      issue: "Kitchen sink leak",
      urgency: "Same evening concern, safe overnight",
      postcode: "UB8 2AA",
      preferred_time: "Tomorrow 08:30",
      outcome: "Callback booked",
    },
    is_demo: true,
    demo_scenario_key: "core-walkthrough",
    created_at: "2026-03-22T18:42:00.000Z",
    messages: [
      {
        id: "44444444-4444-4444-8444-444444444411",
        sort_order: 1,
        offset_seconds: 0,
        role: "system",
        sender_label: "Missed Call Event",
        body: "Missed call received outside working hours from +44 7700 900901.",
        channel: "voice",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:00.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444412",
        sort_order: 2,
        offset_seconds: 4,
        role: "assistant",
        sender_label: "AI SMS Follow-Up",
        body: "Hi, this is Empire AI assistant. I noticed we missed your call. Tell me briefly what the plumbing issue is and I will help arrange the next step.",
        channel: "sms",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:04.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444413",
        sort_order: 3,
        offset_seconds: 10,
        role: "customer",
        sender_label: "Daniel Brooks",
        body: "Kitchen sink pipe is leaking under the cupboard. Not flooding yet but I need someone in the morning.",
        channel: "sms",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:10.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444414",
        sort_order: 4,
        offset_seconds: 15,
        role: "assistant",
        sender_label: "AI SMS Follow-Up",
        body: "Understood. Please confirm your postcode and best callback time tomorrow morning.",
        channel: "sms",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:15.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444415",
        sort_order: 5,
        offset_seconds: 21,
        role: "customer",
        sender_label: "Daniel Brooks",
        body: "UB8 2AA. 8:30 works.",
        channel: "sms",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:21.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444416",
        sort_order: 6,
        offset_seconds: 27,
        role: "assistant",
        sender_label: "AI SMS Follow-Up",
        body: "Thanks. I have booked a callback for 08:30 tomorrow and flagged the issue for the on-call plumbing manager.",
        channel: "sms",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:27.000Z",
      },
    ],
    actions: [
      {
        id: "44444444-4444-4444-8444-444444444421",
        sort_order: 1,
        offset_seconds: 2,
        agent_type: "triage",
        title: "Voice event routed into missed-call recovery",
        detail: "The assistant detected an after-hours missed call and immediately opened an SMS recovery flow.",
        status_label: "triage complete",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:02.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444422",
        sort_order: 2,
        offset_seconds: 12,
        agent_type: "qualification",
        title: "Leak assessed as urgent next-day callback",
        detail: "AI extracted issue type, urgency, and safe overnight handling from the customer's reply.",
        status_label: "facts extracted",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:12.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444423",
        sort_order: 3,
        offset_seconds: 24,
        agent_type: "booking",
        title: "Callback slot reserved",
        detail: "The morning callback was selected and the team was notified with the captured issue summary.",
        status_label: "booking staged",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:24.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444424",
        sort_order: 4,
        offset_seconds: 30,
        agent_type: "escalation",
        title: "On-call manager informed",
        detail: "An escalation note was sent because the event originated from an after-hours missed call.",
        status_label: "staff alerted",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:30.000Z",
      },
    ],
    impacts: [
      {
        id: "44444444-4444-4444-8444-444444444431",
        sort_order: 1,
        offset_seconds: 13,
        impact_type: "lead_created",
        title: "Lead created",
        detail: "A plumbing lead was added automatically with the issue summary and callback target time.",
        crm_entity_type: "lead",
        crm_entity_id: "11111111-1111-4111-8111-111111111112",
        route_path: "/leads",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:13.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444432",
        sort_order: 2,
        offset_seconds: 16,
        impact_type: "customer_matched",
        title: "Customer matched",
        detail: "The enquiry was matched into the existing demo customer profile for fast follow-up.",
        crm_entity_type: "customer",
        crm_entity_id: "11111111-1111-4111-8111-111111111111",
        route_path: "/customers/11111111-1111-4111-8111-111111111111",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:16.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444433",
        sort_order: 3,
        offset_seconds: 26,
        impact_type: "appointment_booked",
        title: "Callback appointment booked",
        detail: "A callback slot was scheduled and surfaced to the operations calendar.",
        crm_entity_type: "appointment",
        crm_entity_id: null,
        route_path: "/calendar",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T18:42:26.000Z",
      },
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444402",
    scenario_key: "urgent-job-booking",
    title: "Urgent Job Booking",
    subtitle: "WhatsApp enquiry turned into a booked emergency visit",
    channel: "whatsapp",
    customer_name: "Nadia Hussain",
    customer_handle: "+44 7700 900902",
    inbound_label: "WhatsApp emergency message at 07:14",
    summary: "AI qualifies a burst pipe, collects the postcode, and books a same-day emergency visit while the office is still opening.",
    final_outcome: "Customer created, job booked, engineer dispatch note prepared, and the customer receives a confirmed arrival window.",
    roi_metrics: {
      missed_calls_recovered: 7,
      bookings_captured: 11,
      leads_qualified: 22,
      average_response_minutes: 1,
    },
    extracted_entities: {
      issue: "Burst pipe under upstairs bathroom",
      urgency: "Emergency same day",
      postcode: "HA4 7DL",
      service: "Emergency plumbing",
      arrival_window: "10:00-12:00",
    },
    is_demo: true,
    demo_scenario_key: "core-walkthrough",
    created_at: "2026-03-22T07:14:00.000Z",
    messages: [
      {
        id: "44444444-4444-4444-8444-444444444441",
        sort_order: 1,
        offset_seconds: 0,
        role: "customer",
        sender_label: "Nadia Hussain",
        body: "Hi, pipe has burst under our bathroom floor and water is coming through the ceiling. Need someone ASAP.",
        channel: "whatsapp",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:00.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444442",
        sort_order: 2,
        offset_seconds: 5,
        role: "assistant",
        sender_label: "AI WhatsApp Agent",
        body: "I can help. Please send your postcode and confirm whether the stop tap is already off.",
        channel: "whatsapp",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:05.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444443",
        sort_order: 3,
        offset_seconds: 11,
        role: "customer",
        sender_label: "Nadia Hussain",
        body: "HA4 7DL and yes the stop tap is off now.",
        channel: "whatsapp",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:11.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        sort_order: 4,
        offset_seconds: 17,
        role: "assistant",
        sender_label: "AI WhatsApp Agent",
        body: "Thanks. I have marked this as an emergency plumbing job and reserved the 10:00-12:00 arrival window. A dispatcher will call if anything changes.",
        channel: "whatsapp",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:17.000Z",
      },
    ],
    actions: [
      {
        id: "44444444-4444-4444-8444-444444444451",
        sort_order: 1,
        offset_seconds: 2,
        agent_type: "triage",
        title: "Emergency intent detected",
        detail: "The assistant routed the conversation directly into the urgent booking path from the first message.",
        status_label: "priority route",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:02.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444452",
        sort_order: 2,
        offset_seconds: 12,
        agent_type: "qualification",
        title: "Risk and postcode captured",
        detail: "Stop-tap status, postcode, and service type were extracted into structured CRM fields.",
        status_label: "qualified",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:12.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444453",
        sort_order: 3,
        offset_seconds: 18,
        agent_type: "booking",
        title: "Emergency window booked",
        detail: "The demo shows the assistant committing the customer to the first suitable arrival window.",
        status_label: "visit booked",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:18.000Z",
      },
    ],
    impacts: [
      {
        id: "44444444-4444-4444-8444-444444444461",
        sort_order: 1,
        offset_seconds: 13,
        impact_type: "customer_created",
        title: "Customer created",
        detail: "A new customer profile is created instantly from the WhatsApp thread.",
        crm_entity_type: "customer",
        crm_entity_id: "11111111-1111-4111-8111-111111111111",
        route_path: "/customers/11111111-1111-4111-8111-111111111111",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:13.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444462",
        sort_order: 2,
        offset_seconds: 19,
        impact_type: "job_created",
        title: "Emergency job booked",
        detail: "Operations gets a booked emergency job with the arrival window and issue summary attached.",
        crm_entity_type: "job",
        crm_entity_id: "11111111-1111-4111-8111-111111111114",
        route_path: "/jobs/11111111-1111-4111-8111-111111111114",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:19.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444463",
        sort_order: 3,
        offset_seconds: 21,
        impact_type: "follow_up_scheduled",
        title: "Dispatcher follow-up staged",
        detail: "A follow-up reminder is queued so the team can confirm ETA if the morning schedule changes.",
        crm_entity_type: "appointment",
        crm_entity_id: null,
        route_path: "/calendar",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T07:14:21.000Z",
      },
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444403",
    scenario_key: "quote-qualification",
    title: "Quote Qualification",
    subtitle: "Web chat enquiry converted into a high-quality sales follow-up",
    channel: "web_chat",
    customer_name: "Ava Mercer",
    customer_handle: "Website visitor",
    inbound_label: "Website chat started from the boiler install page",
    summary: "AI asks targeted boiler-install questions, captures the home details, and pushes a sales-ready lead into the CRM.",
    final_outcome: "Lead qualified, quote follow-up staged, and the sales team can open the linked customer, quote, and invoice demo records.",
    roi_metrics: {
      missed_calls_recovered: 5,
      bookings_captured: 4,
      leads_qualified: 27,
      average_response_minutes: 1,
    },
    extracted_entities: {
      issue: "Boiler replacement quote",
      bedrooms: "3 bedroom house",
      fuel: "Mains gas",
      postcode: "SL0 9JT",
      budget_signal: "Wants finance options",
    },
    is_demo: true,
    demo_scenario_key: "core-walkthrough",
    created_at: "2026-03-22T12:05:00.000Z",
    messages: [
      {
        id: "44444444-4444-4444-8444-444444444471",
        sort_order: 1,
        offset_seconds: 0,
        role: "customer",
        sender_label: "Ava Mercer",
        body: "Hi, I need a quote for replacing my boiler and want to know if finance is possible.",
        channel: "web_chat",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:00.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444472",
        sort_order: 2,
        offset_seconds: 5,
        role: "assistant",
        sender_label: "AI Web Chat Agent",
        body: "Absolutely. How many bedrooms are in the property, is it mains gas, and what postcode is the home in?",
        channel: "web_chat",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:05.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444473",
        sort_order: 3,
        offset_seconds: 11,
        role: "customer",
        sender_label: "Ava Mercer",
        body: "3 bedrooms, mains gas, SL0 9JT.",
        channel: "web_chat",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:11.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444474",
        sort_order: 4,
        offset_seconds: 16,
        role: "assistant",
        sender_label: "AI Web Chat Agent",
        body: "Great. I have qualified this for the sales team, noted finance interest, and arranged a quote follow-up.",
        channel: "web_chat",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:16.000Z",
      },
    ],
    actions: [
      {
        id: "44444444-4444-4444-8444-444444444481",
        sort_order: 1,
        offset_seconds: 2,
        agent_type: "triage",
        title: "Sales intent routed to quote qualification",
        detail: "The web chat was recognized as a high-value boiler replacement enquiry rather than a generic FAQ.",
        status_label: "routed",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:02.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444482",
        sort_order: 2,
        offset_seconds: 12,
        agent_type: "qualification",
        title: "Property and finance signals captured",
        detail: "Bedrooms, fuel type, postcode, and finance intent were added to the lead summary.",
        status_label: "qualified",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:12.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444483",
        sort_order: 3,
        offset_seconds: 17,
        agent_type: "faq",
        title: "Finance question answered",
        detail: "The assistant answered the finance question inline while still progressing the lead toward human follow-up.",
        status_label: "faq answered",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:17.000Z",
      },
    ],
    impacts: [
      {
        id: "44444444-4444-4444-8444-444444444491",
        sort_order: 1,
        offset_seconds: 13,
        impact_type: "lead_created",
        title: "Qualified lead created",
        detail: "The sales team receives a complete lead instead of an unstructured chat transcript.",
        crm_entity_type: "lead",
        crm_entity_id: "11111111-1111-4111-8111-111111111112",
        route_path: "/leads",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:13.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444492",
        sort_order: 2,
        offset_seconds: 18,
        impact_type: "quote_follow_up",
        title: "Quote workflow linked",
        detail: "The demo customer can be opened straight into the quote and invoice history used elsewhere in the CRM walkthrough.",
        crm_entity_type: "quote",
        crm_entity_id: "11111111-1111-4111-8111-111111111117",
        route_path: "/quotes/11111111-1111-4111-8111-111111111117",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:18.000Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444493",
        sort_order: 3,
        offset_seconds: 20,
        impact_type: "invoice_context_ready",
        title: "Commercial context visible",
        detail: "The invoicing path is already connected, making the add-on story feel tied to revenue rather than just chat.",
        crm_entity_type: "invoice",
        crm_entity_id: "11111111-1111-4111-8111-111111111118",
        route_path: "/invoices/11111111-1111-4111-8111-111111111118",
        is_demo: true,
        demo_scenario_key: "core-walkthrough",
        created_at: "2026-03-22T12:05:20.000Z",
      },
    ],
  },
];

export function getAiHubProvider() {
  return new DemoAiHubProvider();
}

export class DemoAiHubProvider implements AiHubProvider {
  async listScenarios() {
    const scenarios = await loadAiHubScenarios();
    return scenarios.sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  async getAggregateMetrics() {
    return buildAiHubAggregateMetrics(await this.listScenarios());
  }
}

export function buildAiHubAggregateMetrics(scenarios: Pick<AiScenario, "roi_metrics">[]) {
  if (scenarios.length === 0) {
    return {
      missed_calls_recovered: 0,
      bookings_captured: 0,
      leads_qualified: 0,
      average_response_minutes: 0,
    } satisfies AiRoiMetrics;
  }

  const totals = scenarios.reduce(
    (sum, scenario) => ({
      missed_calls_recovered: sum.missed_calls_recovered + scenario.roi_metrics.missed_calls_recovered,
      bookings_captured: sum.bookings_captured + scenario.roi_metrics.bookings_captured,
      leads_qualified: sum.leads_qualified + scenario.roi_metrics.leads_qualified,
      average_response_minutes: sum.average_response_minutes + scenario.roi_metrics.average_response_minutes,
    }),
    {
      missed_calls_recovered: 0,
      bookings_captured: 0,
      leads_qualified: 0,
      average_response_minutes: 0,
    },
  );

  return {
    ...totals,
    average_response_minutes: Math.round(totals.average_response_minutes / scenarios.length),
  } satisfies AiRoiMetrics;
}

export function getAiHubUpgradeHref(addon: AddonState) {
  return addon.cta_url?.trim() || "https://customerjourneys.ai/en-GB/demo";
}

async function loadAiHubScenarios(): Promise<AiConversation[]> {
  if (!getCrmEnv().enabled) {
    return buildFallbackAiHubConversations();
  }

  try {
    const supabase = await createCrmServerClient();
    const [{ data: conversations, error: conversationsError }, { data: messages, error: messagesError }, { data: actions, error: actionsError }, { data: impacts, error: impactsError }] =
      await Promise.all([
        supabase.schema("crm").from("ai_conversations").select("*").eq("is_demo", true).order("created_at"),
        supabase.schema("crm").from("ai_messages").select("*").eq("is_demo", true).order("sort_order"),
        supabase.schema("crm").from("ai_actions").select("*").eq("is_demo", true).order("sort_order"),
        supabase.schema("crm").from("ai_crm_impacts").select("*").eq("is_demo", true).order("sort_order"),
      ]);

    if (conversationsError || messagesError || actionsError || impactsError || !conversations?.length) {
      return buildFallbackAiHubConversations();
    }

    const messagesByConversation = groupByConversation(messages as AiMessage[]);
    const actionsByConversation = groupByConversation(actions as AiAgentAction[]);
    const impactsByConversation = groupByConversation(impacts as AiCrmImpact[]);

    return (conversations as Array<Record<string, unknown>>).map((conversation) => {
      const id = String(conversation.id);
      return {
        id,
        scenario_key: String(conversation.scenario_key),
        title: String(conversation.title),
        subtitle: typeof conversation.subtitle === "string" ? conversation.subtitle : null,
        channel: normalizeChannel(conversation.channel),
        customer_name: String(conversation.customer_name),
        customer_handle: String(conversation.customer_handle),
        inbound_label: String(conversation.inbound_label),
        summary: String(conversation.summary),
        final_outcome: String(conversation.final_outcome),
        roi_metrics: normalizeRoiMetrics(conversation.roi_metrics),
        extracted_entities: normalizeExtractedEntities(conversation.extracted_entities),
        is_demo: Boolean(conversation.is_demo),
        demo_scenario_key: normalizeDemoScenarioKey(conversation.demo_scenario_key),
        created_at: String(conversation.created_at),
        messages: messagesByConversation.get(id) ?? [],
        actions: actionsByConversation.get(id) ?? [],
        impacts: impactsByConversation.get(id) ?? [],
      } satisfies AiConversation;
    });
  } catch {
    return buildFallbackAiHubConversations();
  }
}

function buildFallbackAiHubConversations(): AiConversation[] {
  return fallbackScenarios.map((scenario) => ({
    ...scenario,
    messages: scenario.messages.map((message) => ({
      ...message,
      conversation_id: scenario.id,
    })),
    actions: scenario.actions.map((action) => ({
      ...action,
      conversation_id: scenario.id,
    })),
    impacts: scenario.impacts.map((impact) => ({
      ...impact,
      conversation_id: scenario.id,
    })),
  }));
}

function groupByConversation<T extends { conversation_id: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const current = groups.get(row.conversation_id) ?? [];
    current.push(row);
    groups.set(row.conversation_id, current);
  }
  return groups;
}

function normalizeChannel(value: unknown): AiScenario["channel"] {
  if (value === "sms" || value === "whatsapp" || value === "web_chat" || value === "voice") {
    return value;
  }
  return "sms";
}

function normalizeRoiMetrics(value: unknown): AiRoiMetrics {
  if (!value || typeof value !== "object") {
    return buildAiHubAggregateMetrics([]);
  }

  const metrics = value as Record<string, unknown>;
  return {
    missed_calls_recovered: Number(metrics.missed_calls_recovered ?? 0),
    bookings_captured: Number(metrics.bookings_captured ?? 0),
    leads_qualified: Number(metrics.leads_qualified ?? 0),
    average_response_minutes: Number(metrics.average_response_minutes ?? 0),
  };
}

function normalizeExtractedEntities(value: unknown) {
  if (!value || typeof value !== "object") {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [key, String(entryValue)]),
  );
}

function normalizeDemoScenarioKey(value: unknown) {
  return value === "core-walkthrough" ? value : null;
}

export function getAiHubPriceLabelFallback() {
  return fallbackAddonPriceLabel;
}
