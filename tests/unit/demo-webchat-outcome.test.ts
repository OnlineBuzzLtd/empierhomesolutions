import { describe, expect, it } from "vitest";
import { buildDemoWebchatOutcome } from "@/modules/crm/demo-console/server/webchat-outcome";

const base = {
  prospectName: "Shaz Iqbal",
  prospectPhone: "+447779305853",
  customers: [{ id: "customer-1", full_name: "Shaz Iqbal", phone: "+447779305853" }],
  leads: [{ id: "lead-1", customer_id: "customer-1", status: "booked" }],
};

describe("demo webchat outcome", () => {
  it("requires customer, lead, booked job, and appointment for service bookings", () => {
    const outcome = buildDemoWebchatOutcome({
      ...base,
      scenarioKey: "emergency_repair_booking",
      jobs: [{ id: "job-1", customer_id: "customer-1", lead_id: "lead-1", status: "booked" }],
      appointments: [{ id: "appt-1", customer_id: "customer-1", job_id: "job-1", status: "scheduled" }],
    });

    expect(outcome).toMatchObject({
      complete: true,
      summary: "Booked job and appointment are visible in CRM.",
      counts: { customers: 1, leads: 1, jobs: 1, appointments: 1 },
    });
  });

  it("requires survey-classified job and appointment for boiler install surveys", () => {
    const outcome = buildDemoWebchatOutcome({
      ...base,
      scenarioKey: "boiler_install_survey",
      jobs: [
        {
          id: "job-1",
          customer_id: "customer-1",
          lead_id: "lead-1",
          status: "booked",
          visit_classification: "survey_assessment",
          commercial_stage: "survey_booked",
        },
      ],
      appointments: [
        {
          id: "appt-1",
          customer_id: "customer-1",
          job_id: "job-1",
          status: "scheduled",
          visit_classification: "survey_assessment",
        },
      ],
    });

    expect(outcome.complete).toBe(true);
    expect(outcome.summary).toBe("Survey booking is visible in CRM.");
  });

  it("stays incomplete when the CRM trail has no booked appointment", () => {
    const outcome = buildDemoWebchatOutcome({
      ...base,
      scenarioKey: "fixed_price_service_quote",
      jobs: [{ id: "job-1", customer_id: "customer-1", lead_id: "lead-1", status: "booked" }],
      appointments: [],
    });

    expect(outcome.complete).toBe(false);
    expect(outcome.missing).toContain("appointment");
  });
});
