"use client";

import { useState } from "react";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

type TwilioState = {
  messaging_service_sid: string | null;
  voice_number_sid: string | null;
  voice_number_e164: string | null;
  whatsapp_sender_id: string | null;
  whatsapp_status: string;
  last_synced_at: string | null;
  last_error: string | null;
} | null;

type ReprovisionResponse = {
  ok?: boolean;
  error?: string;
  state: TwilioState;
  runtime: {
    channels: Record<string, { ready: boolean; reason?: string | null }>;
    issues: string[];
  } | null;
  warnings: Array<{ step: string; message: string }>;
  allChannelsReady: boolean;
};

type TwilioProvisioningPanelProps = {
  initialState: TwilioState;
};

export function TwilioProvisioningPanel({ initialState }: TwilioProvisioningPanelProps) {
  const demo = useCrmDemoMode();
  const [state, setState] = useState<TwilioState>(initialState);
  const [result, setResult] = useState<ReprovisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleReprovision() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/crm/settings/twilio/reprovision", { method: "POST" });
      const json = (await response.json()) as ReprovisionResponse;
      if (!response.ok || json.error) {
        setError(json.error ?? `Request failed (${response.status}).`);
      } else {
        setResult(json);
        setState(json.state);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <Row label="Messaging Service SID" value={state?.messaging_service_sid} />
        <Row label="Voice number" value={state?.voice_number_e164} />
        <Row label="Voice number SID" value={state?.voice_number_sid} />
        <Row label="WhatsApp Sender" value={state?.whatsapp_sender_id} />
        <Row label="WhatsApp status" value={state?.whatsapp_status ?? "not_started"} />
        <Row label="Last synced" value={state?.last_synced_at} />
      </dl>

      {state?.last_error ? (
        <p className="whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {state.last_error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || demo.active}
          onClick={handleReprovision}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {demo.active ? "Demo Mode Locked" : busy ? "Running…" : "Reprovision Twilio"}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>

      {result ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-800">
            All channels ready: <span className={result.allChannelsReady ? "text-emerald-700" : "text-rose-700"}>{String(result.allChannelsReady)}</span>
          </p>
          {result.runtime ? (
            <ul className="mt-2 space-y-1 text-slate-700">
              {Object.entries(result.runtime.channels).map(([name, v]) => (
                <li key={name}>
                  <span className="font-medium">{name}</span>: {v.ready ? "READY" : `NOT_READY${v.reason ? ` — ${v.reason}` : ""}`}
                </li>
              ))}
            </ul>
          ) : null}
          {result.warnings.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-slate-700">Warnings ({result.warnings.length})</summary>
              <ul className="mt-1 space-y-1 text-slate-700">
                {result.warnings.map((w, i) => (
                  <li key={`${w.step}-${i}`}>
                    <span className="font-medium">{w.step}</span>: {w.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-all text-slate-800">{value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
