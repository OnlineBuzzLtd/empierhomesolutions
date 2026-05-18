"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveDemoPane } from "@/modules/crm/demo-console/LiveDemoPane";
import { WebchatTile } from "@/modules/crm/demo-console/tiles/WebchatTile";
import { VoiceTile } from "@/modules/crm/demo-console/tiles/VoiceTile";
import { MessagingTile } from "@/modules/crm/demo-console/tiles/MessagingTile";
import { InboundLeadTile } from "@/modules/crm/demo-console/tiles/InboundLeadTile";

// Fullscreen prospect-facing stage (ticket D-1 composition). Owns the
// session lifecycle and operator-panel toggle. The operator panel
// itself (Stream E) plugs into this scaffolding via the
// `operatorPanelOpen` state — when E-1 ships, the panel reads
// startSession / endSession from a context the stage provides.
//
// For now (Streams D-only state), there is no consent form yet, so
// the session is started by an explicit "Start preview" button that
// records the current timestamp as sessionStartedAt. This lets the
// operator verify the realtime pane end-to-end before E-2 ships the
// real consent capture.

type DemoRunStageProps = {
  tenantId: string | null;
  tenantName: string;
  voiceNumber: string | null;
  smsNumber: string | null;
  whatsappNumber: string | null;
};

export function DemoRunStage({
  tenantId,
  tenantName,
  voiceNumber,
  smsNumber,
  whatsappNumber,
}: DemoRunStageProps) {
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [operatorPanelOpen, setOperatorPanelOpen] = useState(false);

  // Operator hotkey — Ctrl+Shift+D opens the (placeholder) operator
  // panel. Stream E-1 fills the panel out; for now we just toggle a
  // small drawer showing session controls.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && (event.key === "D" || event.key === "d")) {
        event.preventDefault();
        setOperatorPanelOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Session timer tick.
  useEffect(() => {
    if (!sessionStartedAt) {
      setElapsedSec(0);
      return;
    }
    const tick = () => setElapsedSec(Math.floor((Date.now() - sessionStartedAt.getTime()) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionStartedAt]);

  function startSession() {
    setSessionStartedAt(new Date());
  }
  function endSession() {
    setSessionStartedAt(null);
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Slim header — visible to both prospect and operator. */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {tenantName}
          </p>
          <p className="text-sm font-semibold text-slate-900">In-person demo</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {sessionStartedAt ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
              Session · {formatElapsed(elapsedSec)}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              No active session
            </span>
          )}
          <Link
            href="/demo"
            className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
          >
            Exit
          </Link>
        </div>
      </header>

      {/* Split stage: tiles on the left, live CRM pane on the right. */}
      <main className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-2">
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2">
          <WebchatTile />
          <VoiceTile voiceNumber={voiceNumber} />
          <MessagingTile smsNumber={smsNumber} whatsappNumber={whatsappNumber} />
          <div className="grid grid-rows-2 gap-3">
            <InboundLeadTile kind="google" />
            <InboundLeadTile kind="meta" />
          </div>
        </div>
        <LiveDemoPane sessionStartedAt={sessionStartedAt} tenantId={tenantId} />
      </main>

      {/* Operator panel placeholder (Stream E will replace this). */}
      {operatorPanelOpen ? (
        <aside className="fixed right-4 top-16 z-30 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <header className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Operator panel
            </p>
            <button
              type="button"
              onClick={() => setOperatorPanelOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </header>
          <p className="mt-2 text-xs text-slate-600">
            Stream E will add consent capture, trigger buttons, kill switch, and
            cleanup. For now, manually start/end the session to watch the live
            pane react.
          </p>
          <div className="mt-3 space-y-2">
            {sessionStartedAt ? (
              <button
                type="button"
                onClick={endSession}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                End session (preview only)
              </button>
            ) : (
              <button
                type="button"
                onClick={startSession}
                className="w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start session (preview only)
              </button>
            )}
            <p className="text-[10px] text-slate-400">
              No PECR consent recorded; do not collect prospect data this way.
              Real session start requires E-2.
            </p>
          </div>
        </aside>
      ) : (
        <p className="fixed bottom-3 right-4 z-20 rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
          Ctrl+Shift+D · operator
        </p>
      )}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
