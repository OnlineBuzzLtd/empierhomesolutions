import { describe, expect, it } from "vitest";
import { AGENT_ORDER, AGENT_SCRIPTS } from "@/modules/demo-crm/agent-scripts";
import { applyAgentOutcome, demoCrmReducer } from "@/modules/demo-crm/reducer";
import { createSeedState } from "@/modules/demo-crm/seed";

describe("demo-crm agent outcomes", () => {
  it("covers all five agents", () => {
    expect(AGENT_ORDER).toEqual(["voice", "lead", "messaging", "web_chat", "payments"]);
    for (const id of AGENT_ORDER) {
      expect(AGENT_SCRIPTS[id].turns.length).toBeGreaterThan(0);
      expect(AGENT_SCRIPTS[id].produces.activity.trim()).not.toBe("");
    }
  });

  it("Voice Agent creates a booked lead linked to a new appointment", () => {
    const seed = createSeedState();
    const next = applyAgentOutcome(seed, AGENT_SCRIPTS.voice.produces, "voice");
    expect(next.leads.length).toBe(seed.leads.length + 1);
    expect(next.appointments.length).toBe(seed.appointments.length + 1);
    const newAppt = next.appointments[0];
    expect(newAppt.leadId).toBe(next.leads[0].id); // appointment linked to the new lead
    expect(next.activity.length).toBe(seed.activity.length + 1);
  });

  it("Lead Agent creates a lead and a survey appointment", () => {
    const seed = createSeedState();
    const next = applyAgentOutcome(seed, AGENT_SCRIPTS.lead.produces, "lead");
    expect(next.leads.length).toBe(seed.leads.length + 1);
    expect(next.appointments.length).toBe(seed.appointments.length + 1);
    expect(next.appointments[0].type).toBe("survey");
  });

  it("Messaging Agent creates a lead with no appointment", () => {
    const seed = createSeedState();
    const next = applyAgentOutcome(seed, AGENT_SCRIPTS.messaging.produces, "messaging");
    expect(next.leads.length).toBe(seed.leads.length + 1);
    expect(next.appointments.length).toBe(seed.appointments.length);
  });

  it("Web Chat Agent creates a lead, appointment, and job", () => {
    const seed = createSeedState();
    const next = applyAgentOutcome(seed, AGENT_SCRIPTS.web_chat.produces, "web_chat");
    expect(next.leads.length).toBe(seed.leads.length + 1);
    expect(next.appointments.length).toBe(seed.appointments.length + 1);
    expect(next.jobs.length).toBe(seed.jobs.length + 1);
  });

  it("Payments Agent marks the overdue invoice paid without creating a lead", () => {
    const seed = createSeedState();
    expect(seed.invoices.find((i) => i.ref === "INV-3120")?.status).toBe("overdue");
    const next = applyAgentOutcome(seed, AGENT_SCRIPTS.payments.produces, "payments");
    expect(next.leads.length).toBe(seed.leads.length);
    expect(next.invoices.find((i) => i.ref === "INV-3120")?.status).toBe("paid");
  });

  it("reducer reset reseeds clean state", () => {
    const seed = createSeedState();
    const mutated = applyAgentOutcome(seed, AGENT_SCRIPTS.voice.produces, "voice");
    const reset = demoCrmReducer(mutated, { type: "reset" });
    expect(reset.leads.length).toBe(seed.leads.length);
  });

  it("clear_all wipes every record but keeps the team", () => {
    const seed = createSeedState();
    const cleared = demoCrmReducer(seed, { type: "clear_all" });
    expect(cleared.leads).toEqual([]);
    expect(cleared.appointments).toEqual([]);
    expect(cleared.jobs).toEqual([]);
    expect(cleared.quotes).toEqual([]);
    expect(cleared.invoices).toEqual([]);
    expect(cleared.customers).toEqual([]);
    expect(cleared.activity).toEqual([]);
    expect(cleared.conversations.voice).toEqual([]);
    // Team is retained so agent-created appointments/jobs still show a name.
    expect(cleared.engineers.length).toBe(seed.engineers.length);
    // After clearing, an agent run still materializes fresh records.
    const afterRun = applyAgentOutcome(cleared, AGENT_SCRIPTS.voice.produces, "voice");
    expect(afterRun.leads.length).toBe(1);
    expect(afterRun.appointments.length).toBe(1);
  });
});
