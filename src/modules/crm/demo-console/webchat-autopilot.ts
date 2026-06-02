import type { DemoWebchatScenarioKey } from "@/modules/crm/demo-console/webchat-scenarios";

export type DemoWebchatSpeed = "slow" | "normal" | "fast";
export type DemoWebchatRunnerMode = "ai_customer" | "fixed_script";

export type DemoWebchatAutopilotStatus =
  | "idle"
  | "running"
  | "paused"
  | "stopped"
  | "completed"
  | "blocked"
  | "failed";

export type DemoWebchatAutopilotState = {
  status: DemoWebchatAutopilotStatus;
  scenarioKey: DemoWebchatScenarioKey;
  speed: DemoWebchatSpeed;
  runnerMode: DemoWebchatRunnerMode;
  lineIndex: number;
  message: string | null;
};

export type DemoWebchatAutopilotEvent =
  | { type: "select_scenario"; scenarioKey: DemoWebchatScenarioKey }
  | { type: "select_speed"; speed: DemoWebchatSpeed }
  | { type: "select_runner_mode"; runnerMode: DemoWebchatRunnerMode }
  | {
      type: "start";
      scenarioKey: DemoWebchatScenarioKey;
      speed: DemoWebchatSpeed;
      runnerMode: DemoWebchatRunnerMode;
    }
  | { type: "line"; lineIndex: number; message: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "complete" }
  | { type: "block"; message: string }
  | { type: "fail"; message: string };

export const initialDemoWebchatAutopilotState: DemoWebchatAutopilotState = {
  status: "idle",
  scenarioKey: "emergency_repair_booking",
  speed: "normal",
  runnerMode: "ai_customer",
  lineIndex: 0,
  message: null,
};

export function getDemoWebchatSpeedDelayMs(speed: DemoWebchatSpeed) {
  if (speed === "slow") return 2400;
  if (speed === "fast") return 400;
  return 1200;
}

export function reduceDemoWebchatAutopilot(
  state: DemoWebchatAutopilotState,
  event: DemoWebchatAutopilotEvent,
): DemoWebchatAutopilotState {
  switch (event.type) {
    case "select_scenario":
      if (state.status === "running" || state.status === "paused") return state;
      return { ...state, scenarioKey: event.scenarioKey, lineIndex: 0, message: null };
    case "select_speed":
      return { ...state, speed: event.speed };
    case "select_runner_mode":
      if (state.status === "running" || state.status === "paused") return state;
      return { ...state, runnerMode: event.runnerMode, message: null };
    case "start":
      return {
        status: "running",
        scenarioKey: event.scenarioKey,
        speed: event.speed,
        runnerMode: event.runnerMode,
        lineIndex: 0,
        message:
          event.runnerMode === "ai_customer"
            ? "Starting AI customer webchat."
            : "Starting fixed-script webchat.",
      };
    case "line":
      return { ...state, status: "running", lineIndex: event.lineIndex, message: event.message };
    case "pause":
      return state.status === "running" ? { ...state, status: "paused", message: "Paused." } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "running", message: "Resumed." } : state;
    case "stop":
      return { ...state, status: "stopped", message: "Stopped." };
    case "complete":
      return { ...state, status: "completed", message: "Scenario complete." };
    case "block":
      return { ...state, status: "blocked", message: event.message };
    case "fail":
      return { ...state, status: "failed", message: event.message };
    default:
      return state;
  }
}
