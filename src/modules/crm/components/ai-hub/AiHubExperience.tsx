"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AddonState, AiAgentAction, AiConversation, AiCrmImpact, AiMessage, AiRoiMetrics } from "@/modules/crm/types";
import { AiHubDemoRecordLink } from "@/modules/crm/components/ai-hub/AiHubDemoRecordLink";
import { aiHubMetricLabels, aiHubPaidReasons, formatAiHubMetricValue, getAiHubScenarioDurationMs } from "@/modules/crm/lib/ai-hub-shared";
import type { AiHubViewState } from "@/modules/crm/lib/addons";

export function AiHubExperience({
  addon,
  aggregateMetrics,
  scenarios,
  viewState,
  canManage,
}: {
  addon: AddonState;
  aggregateMetrics: AiRoiMetrics;
  scenarios: AiConversation[];
  viewState: AiHubViewState;
  canManage: boolean;
}) {
  const [selectedScenarioKey, setSelectedScenarioKey] = useState(scenarios[0]?.scenario_key ?? "");
  const [replayCount, setReplayCount] = useState(0);
  const demoBoardRef = useRef<HTMLDivElement | null>(null);
  const roiRef = useRef<HTMLDivElement | null>(null);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.scenario_key === selectedScenarioKey) ?? scenarios[0] ?? null,
    [scenarios, selectedScenarioKey],
  );

  const canWatchDemo = viewState === "enabled" || viewState === "demo";

  function focusDemoBoard() {
    demoBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setReplayCount((count) => count + 1);
  }

  function focusRoi() {
    roiRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1e293b_52%,#1d4ed8)] p-6 text-white shadow-xl shadow-slate-900/15 lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-blue-100">Paid Add-On</span>
              <span className="rounded-full bg-amber-400/90 px-3 py-1.5 text-slate-950">{addon.price_label}</span>
              {!addon.enabled ? <span className="rounded-full bg-white/12 px-3 py-1.5 text-slate-200">Per company</span> : null}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">AI Hub</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
              {addon.summary}
            </p>
            <p className="mt-3 text-sm text-blue-100">
              Customer message or missed call arrives, AI handles the intake flow, and the CRM updates the lead, customer, booking, and commercial context automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {canWatchDemo ? (
              <button
                type="button"
                onClick={focusDemoBoard}
                className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
              >
                Watch Demo
              </button>
            ) : null}
            <button
              type="button"
              onClick={focusRoi}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              See ROI
            </button>
            {canManage && !addon.enabled ? (
              <a
                href={addon.cta_url ?? "https://customerjourneys.ai/en-GB/demo"}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-amber-300 bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300"
              >
                Upgrade
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div ref={roiRef} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(aggregateMetrics).map(([metricKey, value]) => (
          <div key={metricKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {aiHubMetricLabels[metricKey as keyof AiRoiMetrics]}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {formatAiHubMetricValue(metricKey as keyof AiRoiMetrics, value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Demo add-on KPI framing for sales conversations.</p>
          </div>
        ))}
      </div>

      {canWatchDemo && selectedScenario ? (
        <div ref={demoBoardRef} className="space-y-5">
          <div className="flex flex-wrap gap-3">
            {scenarios.map((scenario) => (
              <button
                key={scenario.scenario_key}
                type="button"
                onClick={() => {
                  setSelectedScenarioKey(scenario.scenario_key);
                  setReplayCount((count) => count + 1);
                }}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  selectedScenario.scenario_key === scenario.scenario_key
                    ? "border-blue-300 bg-blue-50 text-blue-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-semibold">{scenario.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{formatChannelLabel(scenario.channel)}</p>
              </button>
            ))}
          </div>

          <AiHubReplayBoard
            key={`${selectedScenario.scenario_key}:${replayCount}`}
            addon={addon}
            conversation={selectedScenario}
            viewState={viewState}
            canManage={canManage}
          />
        </div>
      ) : (
        <LockedAiHubPreview addon={addon} scenarios={scenarios} canManage={canManage} />
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Why This Is Paid</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">A revenue and response-time add-on, not a gimmick</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              AI Hub is sold separately because it captures demand outside office hours, updates the CRM without admin rekeying, and makes comms coverage feel operational instead of experimental.
            </p>
          </div>

          <div className="grid gap-3">
            {aiHubPaidReasons.map((reason) => (
              <div key={reason} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                {reason}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LockedAiHubPreview({
  addon,
  scenarios,
  canManage,
}: {
  addon: AddonState;
  scenarios: AiConversation[];
  canManage: boolean;
}) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-6 shadow-lg shadow-amber-100/60">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Locked Add-On</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">AI Hub is available as a premium comms module</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This CRM account can see the product, but the interactive demo and channel playback are reserved for management/admin or enabled accounts.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
          <p className="font-semibold text-slate-900">{addon.price_label}</p>
          <p className="mt-1">{canManage ? "Use the upgrade CTA to enable the add-on or run the management demo." : "Contact your admin to unlock the AI Hub add-on."}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <div key={scenario.scenario_key} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.72))]" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{formatChannelLabel(scenario.channel)}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{scenario.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{scenario.summary}</p>
            <p className="mt-3 text-xs text-slate-500">{scenario.final_outcome}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiHubReplayBoard({
  addon,
  conversation,
  viewState,
  canManage,
}: {
  addon: AddonState;
  conversation: AiConversation;
  viewState: AiHubViewState;
  canManage: boolean;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const totalDurationMs = getAiHubScenarioDurationMs(conversation);
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const nextElapsedMs = Math.min(performance.now() - startedAt, totalDurationMs);
      setElapsedMs(nextElapsedMs);
      if (nextElapsedMs >= totalDurationMs) {
        window.clearInterval(timer);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [conversation]);

  const progress = Math.min(100, Math.round((elapsedMs / getAiHubScenarioDurationMs(conversation)) * 100));

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
              {formatChannelLabel(conversation.channel)}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              {viewState === "enabled" ? "Add-on Enabled" : "Demo Access"}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">{conversation.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{conversation.summary}</p>
        </div>
        {canManage && !addon.enabled ? (
          <a
            href={addon.cta_url ?? "https://customerjourneys.ai/en-GB/demo"}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Upgrade
          </a>
        ) : null}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#1d4ed8,#0f172a)] transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.1fr_0.95fr]">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inbox</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{conversation.customer_name}</p>
                <p className="mt-1 text-xs text-slate-500">{conversation.customer_handle}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{conversation.inbound_label}</span>
            </div>
            <p className="mt-4 text-sm text-slate-600">{conversation.subtitle}</p>
            <dl className="mt-4 space-y-2 text-sm">
              {Object.entries(conversation.extracted_entities).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-slate-500">{formatEntityKey(key)}</dt>
                  <dd className="text-right font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conversation Thread</p>
            <div className="mt-4 space-y-3">
              {conversation.messages.map((message) => (
                <MessageBubble key={message.id} message={message} visible={elapsedMs >= message.offset_seconds * 1000} />
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Actions Timeline</p>
            <div className="mt-4 space-y-3">
              {conversation.actions.map((action) => (
                <ActionCard key={action.id} action={action} visible={elapsedMs >= action.offset_seconds * 1000} />
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">CRM Impact</p>
            <div className="mt-4 space-y-3">
              {conversation.impacts.map((impact) => (
                <ImpactCard key={impact.id} impact={impact} visible={elapsedMs >= impact.offset_seconds * 1000} canManage={canManage} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Business Outcome</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{conversation.final_outcome}</p>
          </div>
        </section>
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  visible,
}: {
  message: AiMessage;
  visible: boolean;
}) {
  const isCustomer = message.role === "customer";
  const isSystem = message.role === "system";

  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm transition-all duration-300 ${
        visible
          ? isCustomer
            ? "translate-y-0 bg-slate-900 text-white opacity-100"
            : isSystem
              ? "translate-y-0 border border-amber-200 bg-amber-50 text-amber-900 opacity-100"
              : "translate-y-0 border border-slate-200 bg-slate-50 text-slate-800 opacity-100"
          : "translate-y-1 border border-slate-200 bg-white text-slate-300 opacity-40"
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${visible ? (isCustomer ? "text-slate-300" : "text-slate-500") : "text-slate-300"}`}>
        {message.sender_label}
      </p>
      <p className="mt-2 leading-6">{visible ? message.body : "Waiting for the next event..."}</p>
    </div>
  );
}

function ActionCard({
  action,
  visible,
}: {
  action: AiAgentAction;
  visible: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 text-sm transition-all duration-300 ${
        visible ? "translate-y-0 border-blue-200 bg-blue-50 opacity-100" : "translate-y-1 border-slate-200 bg-white opacity-45"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{action.title}</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
          {action.agent_type}
        </span>
      </div>
      <p className="mt-2 text-slate-600">{action.detail}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{action.status_label}</p>
    </div>
  );
}

function ImpactCard({
  impact,
  visible,
  canManage,
}: {
  impact: AiCrmImpact;
  visible: boolean;
  canManage: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 text-sm transition-all duration-300 ${
        visible ? "translate-y-0 border-emerald-200 bg-emerald-50 opacity-100" : "translate-y-1 border-slate-200 bg-white opacity-45"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{impact.title}</p>
          <p className="mt-2 text-slate-600">{impact.detail}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          {impact.impact_type.replaceAll("_", " ")}
        </span>
      </div>

      {visible && impact.route_path && canManage ? (
        <div className="mt-4">
          <AiHubDemoRecordLink href={impact.route_path} label="Open CRM Record" />
        </div>
      ) : null}
    </div>
  );
}

function formatChannelLabel(channel: AiConversation["channel"]) {
  return channel === "web_chat" ? "Web Chat" : channel === "voice" ? "Missed Call" : channel.toUpperCase();
}

function formatEntityKey(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}
