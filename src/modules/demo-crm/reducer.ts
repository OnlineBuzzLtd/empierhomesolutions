/**
 * Pure reducer for the demo CRM. No I/O, no Supabase, no network — just
 * in-memory state transitions. This is the core behaviour the agent-scripts
 * test exercises.
 */
import { createSeedState } from "./seed";
import type { DemoAgentId, DemoAgentOutcome, DemoCrmState, DemoMessage } from "./types";

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export type DemoCrmAction =
  | { type: "reset"; now?: Date }
  | { type: "clear_all" }
  | { type: "clear_conversation"; agent: DemoAgentId }
  | { type: "append_message"; agent: DemoAgentId; message: DemoMessage }
  | { type: "apply_outcome"; agent: DemoAgentId; outcome: DemoAgentOutcome; now?: Date };

const EMPTY_CONVERSATIONS: DemoCrmState["conversations"] = {
  voice: [],
  lead: [],
  messaging: [],
  web_chat: [],
  payments: [],
};

export function demoCrmReducer(state: DemoCrmState, action: DemoCrmAction): DemoCrmState {
  switch (action.type) {
    case "reset":
      return createSeedState(action.now);
    case "clear_all":
      // Wipe every operational record for a clean test slate. Keep the team
      // (engineers) so agent-created appointments/jobs still show a name.
      return {
        ...state,
        customers: [],
        leads: [],
        appointments: [],
        jobs: [],
        quotes: [],
        invoices: [],
        conversations: { ...EMPTY_CONVERSATIONS },
        activity: [],
      };
    case "clear_conversation":
      return {
        ...state,
        conversations: { ...state.conversations, [action.agent]: [] },
      };
    case "append_message":
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [action.agent]: [...state.conversations[action.agent], action.message],
        },
      };
    case "apply_outcome":
      return applyAgentOutcome(state, action.outcome, action.agent, action.now ?? new Date());
    default:
      return state;
  }
}

/**
 * Apply an agent's outcome to the CRM state, returning a new state. Templates
 * are cloned with fresh ids so repeated runs add distinct rows.
 */
export function applyAgentOutcome(
  state: DemoCrmState,
  outcome: DemoAgentOutcome,
  agent: DemoAgentId,
  now: Date = new Date(),
): DemoCrmState {
  const next: DemoCrmState = {
    ...state,
    leads: [...state.leads],
    appointments: [...state.appointments],
    jobs: [...state.jobs],
    quotes: [...state.quotes],
    invoices: [...state.invoices],
    activity: [...state.activity],
  };

  const createdLeadIds: string[] = [];

  for (const leadTemplate of outcome.leads ?? []) {
    const id = genId("lead");
    createdLeadIds.push(id);
    next.leads.unshift({ ...leadTemplate, id, createdAt: now.toISOString() });
  }

  for (const apptTemplate of outcome.appointments ?? []) {
    next.appointments.unshift({
      ...apptTemplate,
      id: genId("appt"),
      // Link to the lead this agent just created, when there is one.
      leadId: createdLeadIds[0] ?? null,
    });
  }

  for (const jobTemplate of outcome.jobs ?? []) {
    next.jobs.unshift({ ...jobTemplate, id: genId("job") });
  }

  for (const quoteTemplate of outcome.quotes ?? []) {
    next.quotes.unshift({ ...quoteTemplate, id: genId("quote") });
  }

  if (outcome.payInvoiceRef) {
    next.invoices = next.invoices.map((inv) =>
      inv.ref === outcome.payInvoiceRef ? { ...inv, status: "paid" as const } : inv,
    );
  }

  next.activity.unshift({
    id: genId("act"),
    at: now.toISOString(),
    agent,
    text: outcome.activity,
  });

  return next;
}
