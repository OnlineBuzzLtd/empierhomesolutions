"use client";

import { useEffect, useMemo, useState } from "react";
import type { DemoPlayback, DemoPlaybackArtifact, DemoPlaybackField } from "@/modules/crm/lib/demo";

const fieldLeadMs = 240;
const fieldSlotMs = 820;
const typeDurationMs = 620;
const artifactLeadMs = 320;
const artifactSlotMs = 520;
const outcomeLeadMs = 320;
const outcomeSlotMs = 380;

export function DemoPlaybackCard({
  playback,
  replayKey,
}: {
  playback: DemoPlayback;
  replayKey: string;
}) {
  const [replayCount, setReplayCount] = useState(0);

  return (
    <DemoPlaybackCardBody
      key={`${replayKey}:${replayCount}`}
      playback={playback}
      onReplay={() => setReplayCount((count) => count + 1)}
    />
  );
}

function DemoPlaybackCardBody({
  playback,
  onReplay,
}: {
  playback: DemoPlayback;
  onReplay: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  const totalDurationMs = useMemo(() => {
    const fieldsDuration = playback.fields.length === 0 ? 0 : fieldLeadMs + playback.fields.length * fieldSlotMs;
    const artifactsDuration =
      playback.artifacts.length === 0 ? 0 : fieldsDuration + artifactLeadMs + playback.artifacts.length * artifactSlotMs;
    const outcomesDuration =
      (playback.outcomes?.length ?? 0) === 0
        ? 0
        : artifactsDuration + outcomeLeadMs + (playback.outcomes?.length ?? 0) * outcomeSlotMs;
    return Math.max(2200, fieldsDuration, artifactsDuration, outcomesDuration) + 380;
  }, [playback]);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const nextElapsedMs = Math.min(performance.now() - startedAt, totalDurationMs);
      setElapsedMs(nextElapsedMs);
      if (nextElapsedMs >= totalDurationMs) {
        window.clearInterval(timer);
      }
    }, 60);

    return () => {
      window.clearInterval(timer);
    };
  }, [totalDurationMs]);

  const progress = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100));
  const artifactsOffsetMs = fieldLeadMs + playback.fields.length * fieldSlotMs + artifactLeadMs;
  const outcomesOffsetMs = artifactsOffsetMs + playback.artifacts.length * artifactSlotMs + outcomeLeadMs;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-4 shadow-lg shadow-amber-200/35">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">Live Demo Replay</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{playback.headline}</h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{playback.summary}</p>
        </div>
        <button
          type="button"
          onClick={onReplay}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"
        >
          Replay Scene
        </button>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-100">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#1d4ed8)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fields Being Populated</p>
          <div className="grid gap-3 md:grid-cols-2">
            {playback.fields.map((field, index) => (
              <DemoFieldCard key={`${field.label}-${index}`} field={field} elapsedMs={elapsedMs} index={index} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow Events</p>
          <div className="space-y-2">
            {playback.artifacts.map((artifact, index) => (
              <DemoArtifactCard
                key={`${artifact.label}-${index}`}
                artifact={artifact}
                visible={elapsedMs >= artifactsOffsetMs + index * artifactSlotMs}
              />
            ))}
          </div>

          {playback.outcomes?.length ? (
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">What This Proves</p>
              <div className="mt-3 space-y-2">
                {playback.outcomes.map((outcome, index) => {
                  const visible = elapsedMs >= outcomesOffsetMs + index * outcomeSlotMs;
                  return (
                    <div
                      key={`${outcome}-${index}`}
                      className={`flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-all duration-300 ${
                        visible ? "translate-y-0 bg-emerald-50 text-slate-700 opacity-100" : "translate-y-1 bg-slate-50 text-slate-400 opacity-60"
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${visible ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"}`}>
                        {visible ? "✓" : "…"}
                      </span>
                      <span>{outcome}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DemoFieldCard({
  field,
  elapsedMs,
  index,
}: {
  field: DemoPlaybackField;
  elapsedMs: number;
  index: number;
}) {
  const startMs = fieldLeadMs + index * fieldSlotMs;
  const finishMs = startMs + typeDurationMs;
  const visible = elapsedMs >= startMs;
  const typedValue = getTypedValue(field.value, elapsedMs, startMs, finishMs);

  return (
    <div
      className={`rounded-xl border px-3 py-3 transition-all duration-300 ${
        visible ? "translate-y-0 border-amber-200 bg-white text-slate-900 opacity-100 shadow-sm" : "translate-y-1 border-slate-200 bg-white/70 text-slate-400 opacity-65"
      } ${field.kind === "textarea" ? "md:col-span-2" : ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{field.label}</p>
      <div
        className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
          field.kind === "pill"
            ? "inline-flex border-amber-200 bg-amber-50 font-semibold text-amber-900"
            : field.kind === "textarea"
              ? "min-h-24 border-slate-200 bg-slate-50 whitespace-pre-wrap"
              : "border-slate-200 bg-slate-50"
        }`}
      >
        <span>{typedValue || (visible ? "" : "Preparing…")}</span>
      </div>
    </div>
  );
}

function DemoArtifactCard({
  artifact,
  visible,
}: {
  artifact: DemoPlaybackArtifact;
  visible: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-sm transition-all duration-300 ${
        visible ? `${getArtifactToneClasses(artifact.tone)} translate-y-0 opacity-100 shadow-sm` : "translate-y-1 border-slate-200 bg-white/70 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{artifact.label}</p>
          <p className="mt-1 text-slate-600">{artifact.detail}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${visible ? "bg-white/80 text-slate-700" : "bg-slate-100 text-slate-500"}`}>
          {visible ? "Visible" : "Queued"}
        </span>
      </div>
    </div>
  );
}

function getTypedValue(value: string, elapsedMs: number, startMs: number, finishMs: number) {
  if (elapsedMs < startMs) {
    return "";
  }

  if (elapsedMs >= finishMs) {
    return value;
  }

  const progress = Math.max(0, Math.min(1, (elapsedMs - startMs) / (finishMs - startMs)));
  const visibleLength = Math.max(1, Math.ceil(value.length * progress));
  return value.slice(0, visibleLength);
}

function getArtifactToneClasses(tone: DemoPlaybackArtifact["tone"]) {
  switch (tone) {
    case "blue":
      return "border-blue-200 bg-blue-50";
    case "emerald":
      return "border-emerald-200 bg-emerald-50";
    case "amber":
      return "border-amber-200 bg-amber-50";
    default:
      return "border-slate-200 bg-white";
  }
}
