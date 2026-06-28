"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { AGENT_ORDER, AGENT_SCRIPTS } from "../agent-scripts";
import { useDemoStore } from "../store";
import type { DemoAgentId } from "../types";
import { AGENT_META, DemoSectionCard, timeAgo } from "./ui";
import { ChannelStage } from "./channels";

export function AgentsView() {
  const { state, runningAgent, runAgent } = useDemoStore();
  const [selected, setSelected] = useState<DemoAgentId>("voice");

  const transcript = state.conversations[selected];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">AI Receptionist</h1>
        <p className="mt-1 text-sm text-slate-500">
          Run any agent to watch a real conversation play out — then see the enquiry, booking, job, or
          payment land in the CRM automatically.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {AGENT_ORDER.map((id) => {
          const meta = AGENT_META[id];
          const script = AGENT_SCRIPTS[id];
          const Icon = meta.icon;
          const isThis = runningAgent === id;
          return (
            <div
              key={id}
              className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition ${
                selected === id ? "border-cyan-400 ring-1 ring-cyan-200" : "border-slate-200"
              }`}
            >
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${meta.chip}`}>
                <Icon size={18} />
              </div>
              <p className="text-sm font-bold text-slate-900">{meta.label}</p>
              <p className="mt-1 flex-1 text-xs leading-5 text-slate-500">{script.blurb}</p>
              <button
                type="button"
                disabled={Boolean(runningAgent)}
                onClick={() => {
                  setSelected(id);
                  void runAgent(id);
                }}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isThis ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {isThis ? "Running…" : "Run agent"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {AGENT_META[selected].label} — live conversation
            </h2>
            <span className="text-xs text-slate-500">{AGENT_SCRIPTS[selected].tagline}</span>
          </div>
          {transcript.length === 0 && runningAgent !== selected ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center text-sm text-slate-400">
              Press “Run agent” to start the conversation.
            </div>
          ) : (
            <ChannelStage agent={selected} messages={transcript} running={runningAgent === selected} />
          )}
        </div>

        <DemoSectionCard title="What just happened" description="Agent activity across the CRM">
          <ul className="space-y-3">
            {state.activity.slice(0, 8).map((item) => (
              <li key={item.id} className="flex gap-3">
                <span
                  className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                    item.agent ? "bg-cyan-500" : "bg-slate-300"
                  }`}
                />
                <div>
                  <p className="text-sm leading-snug text-slate-700">{item.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{timeAgo(item.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </DemoSectionCard>
      </div>
    </div>
  );
}
