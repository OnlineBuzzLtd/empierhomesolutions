"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LiveDemoPane } from "@/modules/crm/demo-console/LiveDemoPane";
import { PreflightBanner } from "@/modules/crm/demo-console/PreflightBanner";
import { WebchatTile } from "@/modules/crm/demo-console/tiles/WebchatTile";
import { VoiceTile } from "@/modules/crm/demo-console/tiles/VoiceTile";
import { MessagingTile } from "@/modules/crm/demo-console/tiles/MessagingTile";
import { InboundLeadTile } from "@/modules/crm/demo-console/tiles/InboundLeadTile";
import {
  OperatorPanel,
  type ActiveDemoSession,
} from "@/modules/crm/demo-console/operator/OperatorPanel";

// Fullscreen prospect-facing stage (ticket D-1 + Stream E integration).
// Owns: session state (synced from /api/crm/demo/sessions/active on
// mount), kill switch state, operator-panel toggle. Delegates real
// session lifecycle to the consent + cleanup endpoints via the panel.
//
// The prospect's name+phone (from the consented session) flow into the
// WebchatTile so the inline chat opens with identity pre-populated.

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
  const [activeSession, setActiveSession] = useState<ActiveDemoSession | null>(null);
  const [killSwitchAt, setKillSwitchAt] = useState<Date | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [operatorPanelOpen, setOperatorPanelOpen] = useState(false);

  // On mount: hydrate session + kill switch state from the server so
  // a refresh / second tab / cleared local state doesn't desync from
  // the DB. The kill switch in particular is per-tenant in
  // tenant_settings — without this fetch, the UI would always show
  // "off" on page load even if a previous session left it set.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/crm/demo/sessions/active", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          active?: boolean;
          session_id?: string;
          started_at?: string;
          prospect_name?: string;
          prospect_phone?: string;
          demo_kill_switch_at?: string | null;
        };
        if (cancelled) return;
        if (body.active && body.session_id && body.started_at) {
          setActiveSession({
            sessionId: body.session_id,
            startedAt: new Date(body.started_at),
            prospectName: body.prospect_name ?? "Prospect",
            prospectPhone: body.prospect_phone ?? "",
          });
        }
        if (body.demo_kill_switch_at) {
          setKillSwitchAt(new Date(body.demo_kill_switch_at));
        }
      } catch {
        /* ignore: panel can still start a fresh session */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Operator hotkey — Ctrl+Shift+D toggles the panel.
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
    if (!activeSession) {
      setElapsedSec(0);
      return;
    }
    const tick = () => setElapsedSec(Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  const onSessionStarted = useCallback((s: ActiveDemoSession) => {
    setActiveSession(s);
  }, []);
  const onSessionEnded = useCallback(() => {
    setActiveSession(null);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {tenantName}
          </p>
          <p className="text-sm font-semibold text-slate-900">In-person demo</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <PreflightBanner />
          {activeSession ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
              {activeSession.prospectName} · {formatElapsed(elapsedSec)}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              No active session
            </span>
          )}
          {killSwitchAt ? (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-700">
              Kill switch ON
            </span>
          ) : null}
          <Link
            href="/demo"
            className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
          >
            Exit
          </Link>
        </div>
      </header>

      {/*
        Layout discipline so tile growth doesn't push others off-screen:
          - main is grid with overflow-hidden + flex-1 → fixed to the
            remaining viewport.
          - left half is a 2×2 grid with explicit grid-rows-2 so each
            tile gets exactly half the available height.
          - inner grids carry min-h-0 so flex children inside the tiles
            (notably the webchat transcript) can shrink and scroll
            instead of forcing their cell to grow.
      */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-2">
        <div className="grid min-h-0 grid-cols-1 grid-rows-4 gap-3 md:grid-cols-2 md:grid-rows-2">
          <WebchatTile
            prospectName={activeSession?.prospectName}
            prospectPhone={activeSession?.prospectPhone}
          />
          <VoiceTile voiceNumber={voiceNumber} />
          <MessagingTile smsNumber={smsNumber} whatsappNumber={whatsappNumber} />
          <div className="grid min-h-0 grid-rows-2 gap-3">
            <InboundLeadTile kind="google" />
            <InboundLeadTile kind="meta" />
          </div>
        </div>
        <LiveDemoPane
          sessionStartedAt={activeSession?.startedAt ?? null}
          tenantId={tenantId}
        />
      </main>

      {operatorPanelOpen ? (
        <OperatorPanel
          activeSession={activeSession}
          killSwitchAt={killSwitchAt}
          onClose={() => setOperatorPanelOpen(false)}
          onSessionStarted={onSessionStarted}
          onSessionEnded={onSessionEnded}
          onKillSwitchToggled={setKillSwitchAt}
        />
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
