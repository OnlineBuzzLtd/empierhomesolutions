"use client";

import { useState } from "react";
import { ConsentForm } from "@/modules/crm/demo-console/operator/ConsentForm";

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
};

type TriggerResult = {
  channel: "google" | "meta";
  ok: boolean;
  message: string;
  at: Date;
};

export function OperatorPanel({
  activeSession,
  killSwitchAt,
  onClose,
  onSessionStarted,
  onSessionEnded,
  onKillSwitchToggled,
}: OperatorPanelProps) {
  const [triggerResults, setTriggerResults] = useState<TriggerResult[]>([]);
  const [triggerBusy, setTriggerBusy] = useState<"google" | "meta" | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [killBusy, setKillBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const killActive =
    killSwitchAt !== null && Date.now() - killSwitchAt.getTime() < 24 * 60 * 60 * 1000;
  const triggersDisabled = !activeSession || killActive || triggerBusy !== null;

  async function fireTrigger(channel: "google" | "meta") {
    setError(null);
    setTriggerBusy(channel);
    try {
      const res = await fetch(`/api/crm/demo/trigger/${channel}`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      const ok = res.ok && body.ok === true;
      setTriggerResults((prev) => [
        {
          channel,
          ok,
          message: ok ? "Fired — watch the live pane." : body.error ?? `HTTP ${res.status}`,
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
            {killSwitchAt?.toLocaleTimeString()}. Clear it below when you've investigated.
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
