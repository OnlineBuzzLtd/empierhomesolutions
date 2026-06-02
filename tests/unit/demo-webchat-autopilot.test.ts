import { describe, expect, it } from "vitest";
import {
  getDemoWebchatSpeedDelayMs,
  initialDemoWebchatAutopilotState,
  reduceDemoWebchatAutopilot,
} from "@/modules/crm/demo-console/webchat-autopilot";
import {
  DEMO_WEBCHAT_SCENARIOS,
  renderDemoWebchatLine,
  renderDemoWebchatScenarioFacts,
} from "@/modules/crm/demo-console/webchat-scenarios";

describe("demo webchat scenarios", () => {
  it("ships the three v1 scenarios", () => {
    expect(DEMO_WEBCHAT_SCENARIOS.map((scenario) => scenario.key)).toEqual([
      "emergency_repair_booking",
      "boiler_install_survey",
      "fixed_price_service_quote",
    ]);
    expect(DEMO_WEBCHAT_SCENARIOS.every((scenario) => scenario.lines.length >= 4)).toBe(true);
    expect(DEMO_WEBCHAT_SCENARIOS.every((scenario) => scenario.facts.openingMessage.length > 0)).toBe(true);
    expect(DEMO_WEBCHAT_SCENARIOS.every((scenario) => scenario.facts.consolidatedDetailsMessage.length > 0)).toBe(true);
  });

  it("renders consented prospect placeholders into scripted lines and facts", () => {
    expect(
      renderDemoWebchatLine("My name is {{prospect_name}} and my number is {{prospect_phone}}.", {
        prospectName: "Shaz Iqbal",
        prospectPhone: "+447779305853",
      }),
    ).toBe("My name is Shaz Iqbal and my number is +447779305853.");
    const facts = renderDemoWebchatScenarioFacts(DEMO_WEBCHAT_SCENARIOS[0], {
      prospectName: "Shaz Iqbal",
      prospectPhone: "+447779305853",
    });
    expect(facts.consolidatedDetailsMessage).toContain("Shaz Iqbal");
    expect(facts.consolidatedDetailsMessage).toContain("+447779305853");
  });
});

describe("demo webchat autopilot reducer", () => {
  it("handles start, line, pause, resume, stop, complete, and fail", () => {
    const started = reduceDemoWebchatAutopilot(initialDemoWebchatAutopilotState, {
      type: "start",
      scenarioKey: "boiler_install_survey",
      speed: "fast",
      runnerMode: "ai_customer",
    });
    expect(started).toMatchObject({
      status: "running",
      scenarioKey: "boiler_install_survey",
      speed: "fast",
      runnerMode: "ai_customer",
    });

    const onLine = reduceDemoWebchatAutopilot(started, { type: "line", lineIndex: 2, message: "Sending line 3." });
    expect(onLine).toMatchObject({ status: "running", lineIndex: 2, message: "Sending line 3." });

    const paused = reduceDemoWebchatAutopilot(onLine, { type: "pause" });
    expect(paused.status).toBe("paused");

    const resumed = reduceDemoWebchatAutopilot(paused, { type: "resume" });
    expect(resumed.status).toBe("running");

    expect(reduceDemoWebchatAutopilot(resumed, { type: "stop" }).status).toBe("stopped");
    expect(reduceDemoWebchatAutopilot(resumed, { type: "complete" }).status).toBe("completed");
    expect(reduceDemoWebchatAutopilot(resumed, { type: "block", message: "No LLM." })).toMatchObject({
      status: "blocked",
      message: "No LLM.",
    });
    expect(reduceDemoWebchatAutopilot(resumed, { type: "fail", message: "CJ failed." })).toMatchObject({
      status: "failed",
      message: "CJ failed.",
    });
  });

  it("does not let scenario selection change while running", () => {
    const running = reduceDemoWebchatAutopilot(initialDemoWebchatAutopilotState, {
      type: "start",
      scenarioKey: "emergency_repair_booking",
      speed: "normal",
      runnerMode: "fixed_script",
    });
    expect(
      reduceDemoWebchatAutopilot(running, {
        type: "select_scenario",
        scenarioKey: "fixed_price_service_quote",
      }).scenarioKey,
    ).toBe("emergency_repair_booking");
  });

  it("uses AI customer mode by default and blocks runner mode changes while running", () => {
    expect(initialDemoWebchatAutopilotState.runnerMode).toBe("ai_customer");
    const fixed = reduceDemoWebchatAutopilot(initialDemoWebchatAutopilotState, {
      type: "select_runner_mode",
      runnerMode: "fixed_script",
    });
    expect(fixed.runnerMode).toBe("fixed_script");
    const running = reduceDemoWebchatAutopilot(fixed, {
      type: "start",
      scenarioKey: "emergency_repair_booking",
      speed: "normal",
      runnerMode: "fixed_script",
    });
    expect(
      reduceDemoWebchatAutopilot(running, {
        type: "select_runner_mode",
        runnerMode: "ai_customer",
      }).runnerMode,
    ).toBe("fixed_script");
  });

  it("uses ordered delays for slow, normal, and fast", () => {
    expect(getDemoWebchatSpeedDelayMs("slow")).toBeGreaterThan(getDemoWebchatSpeedDelayMs("normal"));
    expect(getDemoWebchatSpeedDelayMs("normal")).toBeGreaterThan(getDemoWebchatSpeedDelayMs("fast"));
  });
});
