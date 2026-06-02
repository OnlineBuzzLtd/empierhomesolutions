"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ConsentForm } from "@/modules/crm/demo-console/operator/ConsentForm";
import type { ParsedWebchatMessage } from "@/modules/crm/demo-console/parse-webchat-session";
import type { DemoWebchatController } from "@/modules/crm/demo-console/use-demo-webchat";
import {
  DEMO_WEBCHAT_SCENARIOS,
  getDemoWebchatScenario,
  renderDemoWebchatLine,
  renderDemoWebchatScenarioFacts,
  type DemoWebchatScenarioKey,
} from "@/modules/crm/demo-console/webchat-scenarios";
import {
  getDemoWebchatSpeedDelayMs,
  initialDemoWebchatAutopilotState,
  reduceDemoWebchatAutopilot,
  type DemoWebchatRunnerMode,
  type DemoWebchatSpeed,
} from "@/modules/crm/demo-console/webchat-autopilot";

// Operator panel (tickets E-1 + E-4 + E-5 + E-6 assembled). Opened via
// Ctrl+Shift+D on /demo/run. Sections:
//   - Consent (E-2)         — start a session by capturing PECR consent
//   - Triggers (E-4)        — fire captured Google / Meta lead replays
//   - End & cleanup (E-5)   — close the session and wipe is_test rows
//   - Kill switch (E-6)     — halt new triggers, big red button
//
// Stateless about the active session — receives it as a prop from
// DemoRunStage and reports start/end events back via callbacks. That
// keeps the panel testable in isolation and lets the same panel work
// in other surfaces later (e.g. an admin-only standalone /demo/operator
// page if useful).

export type ActiveDemoSession = {
  sessionId: string;
  startedAt: Date;
  prospectName: string;
  prospectPhone: string;
};

type OperatorPanelProps = {
  activeSession: ActiveDemoSession | null;
  killSwitchAt: Date | null;
  onClose: () => void;
  onSessionStarted: (session: ActiveDemoSession) => void;
  onSessionEnded: () => void;
  onKillSwitchToggled: (newValue: Date | null) => void;
  webchat: DemoWebchatController;
};

export type TriggerResult = {
  channel: "google" | "meta" | "quote" | "webchat";
  ok: boolean;
  message: string;
  at: Date;
};

export function clearWebchatTriggerResults(results: TriggerResult[]) {
  return results.filter((result) => result.channel !== "webchat");
}

type DemoCustomerTurnResponse = {
  ok?: boolean;
  error?: string;
  turn?: {
    status?: "message" | "complete" | "blocked";
    message?: string | null;
    reason?: string;
    stopCode?: string;
  };
};

type DemoScenarioOutcomeResponse = {
  ok?: boolean;
  error?: string;
  outcome?: {
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
};

type ScenarioRunOutcome =
  | { status: "completed"; message: string }
  | { status: "blocked"; message: string };

function appendTranscriptMessages(
  current: ParsedWebchatMessage[],
  next: ParsedWebchatMessage[],
) {
  const seen = new Set(current.map((message) => message.id));
  const merged = [...current];
  for (const message of next) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    merged.push(message);
  }
  return merged;
}

export function OperatorPanel({
  activeSession,
  killSwitchAt,
  onClose,
  onSessionStarted,
  onSessionEnded,
  onKillSwitchToggled,
  webchat,
}: OperatorPanelProps) {
  const [triggerResults, setTriggerResults] = useState<TriggerResult[]>([]);
  const [triggerBusy, setTriggerBusy] = useState<"google" | "meta" | null>(null);
  const [quoteBusy, setQuoteBusy] = useState<"mark_survey_done_then_draft" | "draft_from_service_booking" | "generate_deposit_invoice" | null>(null);
  const [autopilot, dispatchAutopilot] = useReducer(
    reduceDemoWebchatAutopilot,
    initialDemoWebchatAutopilotState,
  );
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [killBusy, setKillBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autopilotStoppedRef = useRef(false);
  const autopilotPausedRef = useRef(false);
  const autopilotRunIdRef = useRef(0);

  const killActive =
    killSwitchAt !== null && Date.now() - killSwitchAt.getTime() < 24 * 60 * 60 * 1000;
  const triggersDisabled = !activeSession || killActive || triggerBusy !== null;
  const autopilotActive = autopilot.status === "running" || autopilot.status === "paused";
  const selectedScenario = getDemoWebchatScenario(autopilot.scenarioKey);

  useEffect(() => {
    if (!activeSession) {
      autopilotStoppedRef.current = true;
      autopilotPausedRef.current = false;
      dispatchAutopilot({ type: "stop" });
    }
  }, [activeSession]);

  function wait(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitWhilePaused() {
    while (autopilotPausedRef.current && !autopilotStoppedRef.current) {
      await wait(150);
    }
  }

  async function waitWithControls(ms: number) {
    const started = Date.now();
    while (Date.now() - started < ms) {
      if (autopilotStoppedRef.current) return;
      await waitWhilePaused();
      await wait(Math.min(150, ms - (Date.now() - started)));
    }
  }

  async function getNextDemoCustomerTurn(input: {
    scenarioKey: DemoWebchatScenarioKey;
    transcript: ParsedWebchatMessage[];
    turnIndex: number;
  }) {
    const res = await fetch("/api/crm/demo/webchat/next-customer-turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => ({}))) as DemoCustomerTurnResponse;
    if (!res.ok || body.ok !== true || !body.turn) {
      throw new Error(body.error ?? `Demo customer HTTP ${res.status}`);
    }
    return body.turn;
  }

  async function getScenarioOutcome(scenarioKey: DemoWebchatScenarioKey) {
    const res = await fetch("/api/crm/demo/webchat/outcome", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioKey }),
    });
    const body = (await res.json().catch(() => ({}))) as DemoScenarioOutcomeResponse;
    if (!res.ok || body.ok !== true || !body.outcome) {
      throw new Error(body.error ?? `Demo outcome HTTP ${res.status}`);
    }
    return body.outcome;
  }

  async function waitForScenarioOutcome(input: {
    scenarioKey: DemoWebchatScenarioKey;
    runId: number;
    attempts?: number;
  }) {
    const attempts = input.attempts ?? 8;
    let lastSummary = "Waiting for CRM records.";
    for (let index = 0; index < attempts; index += 1) {
      if (autopilotStoppedRef.current || autopilotRunIdRef.current !== input.runId) {
        return { complete: false, summary: "Scenario stopped.", missing: ["stopped"] };
      }
      dispatchAutopilot({
        type: "line",
        lineIndex: index,
        message: "Checking the CRM booking trail.",
      });
      const outcome = await getScenarioOutcome(input.scenarioKey);
      lastSummary = outcome.summary;
      if (outcome.complete) return outcome;
      await waitWithControls(750);
    }
    return { complete: false, summary: lastSummary, missing: ["CRM booking trail"] };
  }

  async function runFixedScriptScenario(input: {
    scenarioKey: DemoWebchatScenarioKey;
    speed: DemoWebchatSpeed;
    runId: number;
  }): Promise<ScenarioRunOutcome> {
    if (!activeSession) return { status: "blocked", message: "No active demo session." };
    const scenario = getDemoWebchatScenario(input.scenarioKey);
    let conversationId: string | null = null;
    for (let index = 0; index < scenario.lines.length; index += 1) {
      if (autopilotStoppedRef.current || autopilotRunIdRef.current !== input.runId) {
        return { status: "blocked", message: "Scenario stopped." };
      }
      await waitWhilePaused();
      const line = renderDemoWebchatLine(scenario.lines[index], {
        prospectName: activeSession.prospectName,
        prospectPhone: activeSession.prospectPhone,
      });
      dispatchAutopilot({
        type: "line",
        lineIndex: index,
        message: `Sending fixed line ${index + 1} of ${scenario.lines.length}.`,
      });
      const sent = await webchat.sendMessage(line, {
        scenarioKey: input.scenarioKey,
        forceNewSession: index === 0,
        conversationId,
      });
      conversationId = sent.conversationId;
      const outcome = await waitForScenarioOutcome({
        scenarioKey: input.scenarioKey,
        runId: input.runId,
        attempts: 2,
      });
      if (outcome.complete) {
        return { status: "completed", message: outcome.summary };
      }
      await waitWithControls(getDemoWebchatSpeedDelayMs(input.speed));
    }
    const finalOutcome = await waitForScenarioOutcome({
      scenarioKey: input.scenarioKey,
      runId: input.runId,
      attempts: 8,
    });
    return finalOutcome.complete
      ? { status: "completed", message: finalOutcome.summary }
      : { status: "blocked", message: finalOutcome.summary };
  }

  async function runAiCustomerScenario(input: {
    scenarioKey: DemoWebchatScenarioKey;
    speed: DemoWebchatSpeed;
    runId: number;
  }): Promise<ScenarioRunOutcome> {
    if (!activeSession) return { status: "blocked", message: "No active demo session." };
    const scenario = getDemoWebchatScenario(input.scenarioKey);
    const facts = renderDemoWebchatScenarioFacts(scenario, {
      prospectName: activeSession.prospectName,
      prospectPhone: activeSession.prospectPhone,
    });
    let transcript: ParsedWebchatMessage[] = [];
    let conversationId: string | null = null;

    dispatchAutopilot({
      type: "line",
      lineIndex: 0,
      message: "Sending opening customer message.",
    });
    const opening = await webchat.sendMessage(facts.openingMessage, {
      scenarioKey: input.scenarioKey,
      forceNewSession: true,
    });
    conversationId = opening.conversationId;
    transcript = appendTranscriptMessages(transcript, opening.messages);
    await waitWithControls(getDemoWebchatSpeedDelayMs(input.speed));

    for (let turnIndex = 1; turnIndex <= 8; turnIndex += 1) {
      if (autopilotStoppedRef.current || autopilotRunIdRef.current !== input.runId) {
        return { status: "blocked", message: "Scenario stopped." };
      }
      await waitWhilePaused();
      dispatchAutopilot({
        type: "line",
        lineIndex: turnIndex,
        message: "Reading the AI reply.",
      });
      const latestAiReply = [...transcript].reverse().find((message) => message.direction === "outbound");
      if (!latestAiReply) {
        return { status: "blocked", message: "The AI did not return a reply to answer." };
      }

      dispatchAutopilot({
        type: "line",
        lineIndex: turnIndex,
        message: "Generating the next customer reply.",
      });
      const nextTurn = await getNextDemoCustomerTurn({
        scenarioKey: input.scenarioKey,
        transcript,
        turnIndex,
      });
      if (nextTurn.status === "complete") {
        const outcome = await waitForScenarioOutcome({
          scenarioKey: input.scenarioKey,
          runId: input.runId,
          attempts: 8,
        });
        return outcome.complete
          ? { status: "completed", message: outcome.summary }
          : {
              status: "blocked",
              message: `${nextTurn.reason ?? `${scenario.label} completed.`} ${outcome.summary}`,
            };
      }
      if (nextTurn.status !== "message" || !nextTurn.message) {
        return {
          status: "blocked",
          message: nextTurn.reason ?? "Demo customer could not generate a safe next reply.",
        };
      }

      dispatchAutopilot({
        type: "line",
        lineIndex: turnIndex,
        message: "Sending adaptive customer reply.",
      });
      const sent = await webchat.sendMessage(nextTurn.message, {
        scenarioKey: input.scenarioKey,
        conversationId,
      });
      conversationId = sent.conversationId;
      transcript = appendTranscriptMessages(transcript, sent.messages);
      const outcome = await waitForScenarioOutcome({
        scenarioKey: input.scenarioKey,
        runId: input.runId,
        attempts: 2,
      });
      if (outcome.complete) {
        return { status: "completed", message: outcome.summary };
      }
      await waitWithControls(getDemoWebchatSpeedDelayMs(input.speed));
    }

    return { status: "blocked", message: "Stopped after the maximum adaptive turns." };
  }

  async function startWebchatScenario() {
    if (!activeSession || killActive || autopilotActive || webchat.busy) return;
    const scenarioKey = autopilot.scenarioKey;
    const speed = autopilot.speed;
    const runnerMode = autopilot.runnerMode;
    const scenario = getDemoWebchatScenario(scenarioKey);
    const runId = autopilotRunIdRef.current + 1;
    autopilotRunIdRef.current = runId;
    autopilotStoppedRef.current = false;
    autopilotPausedRef.current = false;
    webchat.reset();
    dispatchAutopilot({ type: "start", scenarioKey, speed, runnerMode });
    setError(null);
    setTriggerResults(clearWebchatTriggerResults);

    try {
      const outcome =
        runnerMode === "ai_customer"
          ? await runAiCustomerScenario({ scenarioKey, speed, runId })
          : await runFixedScriptScenario({ scenarioKey, speed, runId });
      if (autopilotStoppedRef.current || autopilotRunIdRef.current !== runId) return;
      if (outcome.status === "blocked") {
        dispatchAutopilot({ type: "block", message: outcome.message });
        setTriggerResults((prev) => [
          {
            channel: "webchat",
            ok: false,
            message: outcome.message,
            at: new Date(),
          },
          ...prev.slice(0, 9),
        ]);
        return;
      }
      dispatchAutopilot({ type: "complete" });
      setTriggerResults((prev) => [
        {
          channel: "webchat",
          ok: true,
          message: outcome.message || `${scenario.label} completed.`,
          at: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    } catch (caught) {
      if (autopilotStoppedRef.current || autopilotRunIdRef.current !== runId) return;
      const message = caught instanceof Error ? caught.message : "Scripted webchat failed.";
      dispatchAutopilot({ type: "fail", message });
      setTriggerResults((prev) => [
        {
          channel: "webchat",
          ok: false,
          message,
          at: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    }
  }

  function pauseWebchatScenario() {
    autopilotPausedRef.current = true;
    dispatchAutopilot({ type: "pause" });
  }

  function resumeWebchatScenario() {
    autopilotPausedRef.current = false;
    dispatchAutopilot({ type: "resume" });
  }

  function stopWebchatScenario() {
    autopilotStoppedRef.current = true;
    autopilotPausedRef.current = false;
    autopilotRunIdRef.current += 1;
    dispatchAutopilot({ type: "stop" });
  }

  async function fireTrigger(channel: "google" | "meta") {
    setError(null);
    setTriggerBusy(channel);
    try {
      const res = await fetch(`/api/crm/demo/trigger/${channel}`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: number;
        detail?: string;
      };
      const ok = res.ok && body.ok === true;
      const errorLine = body.error ?? `HTTP ${res.status}`;
      const detailLine =
        body.status || body.detail
          ? ` [downstream ${body.status ?? "?"}: ${(body.detail ?? "").slice(0, 200)}]`
          : "";
      setTriggerResults((prev) => [
        {
          channel,
          ok,
          message: ok ? "Fired — watch the live pane." : `${errorLine}${detailLine}`,
          at: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trigger failed.");
    } finally {
      setTriggerBusy(null);
    }
  }

  async function runQuoteAction(action: "mark_survey_done_then_draft" | "draft_from_service_booking" | "generate_deposit_invoice") {
    setError(null);
    setQuoteBusy(action);
    try {
      const res = await fetch("/api/crm/demo/quote/from-job", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        quoteAutomation?: { status?: string; quoteId?: string | null; blockers?: Array<{ message?: string }> };
        invoice?: { invoice_number?: string; total?: number };
      };
      const ok = res.ok && body.ok === true;
      const blocker = body.quoteAutomation?.blockers?.[0]?.message;
      const message = ok
        ? body.invoice?.invoice_number
          ? `Invoice ${body.invoice.invoice_number} generated.`
          : body.quoteAutomation?.quoteId
            ? `Quote ${body.quoteAutomation.quoteId.slice(0, 8)} ${body.quoteAutomation.status ?? "ready"}.`
            : blocker ?? "Quote action completed."
        : body.error ?? blocker ?? `HTTP ${res.status}`;
      setTriggerResults((prev) => [
        {
          channel: "quote",
          ok,
          message,
          at: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quote action failed.");
    } finally {
      setQuoteBusy(null);
    }
  }

  async function runCleanup() {
    setError(null);
    setCleanupBusy(true);
    try {
      const res = await fetch("/api/crm/demo/cleanup", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; deleted?: Record<string, number> };
      if (!res.ok || body.ok !== true) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const total = Object.values(body.deleted ?? {}).reduce((sum, n) => sum + n, 0);
      setTriggerResults((prev) => [
        {
          channel: "google",
          ok: true,
          message: `Cleanup: deleted ${total} rows across ${Object.keys(body.deleted ?? {}).length} tables.`,
          at: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
      onSessionEnded();
      setCleanupConfirm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cleanup failed.");
    } finally {
      setCleanupBusy(false);
    }
  }

  async function toggleKill(clear: boolean) {
    setError(null);
    setKillBusy(true);
    try {
      const res = await fetch("/api/crm/demo/kill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clear }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        demo_kill_switch_at?: string | null;
      };
      if (!res.ok || body.ok !== true) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onKillSwitchToggled(body.demo_kill_switch_at ? new Date(body.demo_kill_switch_at) : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kill switch toggle failed.");
    } finally {
      setKillBusy(false);
    }
  }

  return (
    <aside className="fixed right-4 top-16 z-30 max-h-[calc(100vh-5rem)] w-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Operator panel
          </p>
          {activeSession ? (
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {activeSession.prospectName} · {activeSession.prospectPhone}
            </p>
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-slate-500">No active session</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Close
        </button>
      </header>

      {killActive ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <p className="font-semibold">Kill switch active.</p>
          <p className="mt-1">
            All trigger buttons disabled. Set at{" "}
            {killSwitchAt?.toLocaleTimeString()}. Clear it below when you have investigated.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
      ) : null}

      {!activeSession ? (
        <section className="mt-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Capture consent + start session
          </h3>
          <ConsentForm onSessionStarted={onSessionStarted} />
        </section>
      ) : (
        <>
          <section className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Trigger inbound leads
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fireTrigger("google")}
                disabled={triggersDisabled}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {triggerBusy === "google" ? "Firing…" : "Google lead"}
              </button>
              <button
                type="button"
                onClick={() => fireTrigger("meta")}
                disabled={triggersDisabled}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {triggerBusy === "meta" ? "Firing…" : "Meta lead"}
              </button>
            </div>
            {triggerResults.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px]">
                {triggerResults.map((r, i) => (
                  <li
                    key={i}
                    className={`rounded-md px-2 py-1 ${r.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
                  >
                    <span className="font-semibold capitalize">{r.channel}</span>{" "}
                    {r.at.toLocaleTimeString()} — {r.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Scripted webchat
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["ai_customer", "AI customer"],
                ["fixed_script", "Fixed script"],
              ] as Array<[DemoWebchatRunnerMode, string]>).map(([runnerMode, label]) => (
                <button
                  key={runnerMode}
                  type="button"
                  onClick={() => dispatchAutopilot({ type: "select_runner_mode", runnerMode })}
                  disabled={autopilotActive}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                    autopilot.runnerMode === runnerMode
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={autopilot.scenarioKey}
              onChange={(event) =>
                dispatchAutopilot({
                  type: "select_scenario",
                  scenarioKey: event.target.value as DemoWebchatScenarioKey,
                })
              }
              disabled={autopilotActive}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
            >
              {DEMO_WEBCHAT_SCENARIOS.map((scenario) => (
                <option key={scenario.key} value={scenario.key}>
                  {scenario.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-snug text-slate-500">
              {selectedScenario.description}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["slow", "normal", "fast"] as DemoWebchatSpeed[]).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => dispatchAutopilot({ type: "select_speed", speed })}
                  disabled={autopilotActive}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize disabled:opacity-50 ${
                    autopilot.speed === speed
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {speed}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={startWebchatScenario}
                disabled={!activeSession || killActive || autopilotActive || webchat.busy}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start
              </button>
              <button
                type="button"
                onClick={pauseWebchatScenario}
                disabled={autopilot.status !== "running"}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={resumeWebchatScenario}
                disabled={autopilot.status !== "paused"}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={stopWebchatScenario}
                disabled={!autopilotActive}
                className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stop
              </button>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <p className="font-semibold capitalize text-slate-800">{autopilot.status}</p>
              <p>
                {autopilot.message ??
                  (autopilot.runnerMode === "ai_customer"
                    ? "AI customer will answer the live AI's actual questions."
                    : selectedScenario.expectedOutcome)}
              </p>
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              AI quote story
            </h3>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => runQuoteAction("mark_survey_done_then_draft")}
                disabled={triggersDisabled || quoteBusy !== null}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quoteBusy === "mark_survey_done_then_draft" ? "Drafting..." : "Mark survey done + draft quote"}
              </button>
              <button
                type="button"
                onClick={() => runQuoteAction("draft_from_service_booking")}
                disabled={triggersDisabled || quoteBusy !== null}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quoteBusy === "draft_from_service_booking" ? "Drafting..." : "Run AI quote draft"}
              </button>
              <button
                type="button"
                onClick={() => runQuoteAction("generate_deposit_invoice")}
                disabled={triggersDisabled || quoteBusy !== null}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quoteBusy === "generate_deposit_invoice" ? "Generating..." : "Generate deposit invoice"}
              </button>
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              End demo + cleanup
            </h3>
            {!cleanupConfirm ? (
              <button
                type="button"
                onClick={() => setCleanupConfirm(true)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                End session & wipe demo rows
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Confirm cleanup.</p>
                <p>
                  This deletes every is_test row in this tenant created since{" "}
                  {activeSession.startedAt.toLocaleTimeString()}. Plumbersrus / other
                  tenants are not touched.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={runCleanup}
                    disabled={cleanupBusy}
                    className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {cleanupBusy ? "Wiping…" : "Yes, wipe"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCleanupConfirm(false)}
                    disabled={cleanupBusy}
                    className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <section className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Kill switch
        </h3>
        {killActive ? (
          <button
            type="button"
            onClick={() => toggleKill(true)}
            disabled={killBusy}
            className="w-full rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {killBusy ? "Clearing…" : "Clear kill switch"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => toggleKill(false)}
            disabled={killBusy}
            className="w-full rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {killBusy ? "Setting…" : "Stop all demo triggers"}
          </button>
        )}
        <p className="text-[10px] text-slate-400">
          Halts new demo events from this UI. In-flight Twilio outbound depends on G-1
          being deployed in the platform-api repo.
        </p>
      </section>
    </aside>
  );
}
