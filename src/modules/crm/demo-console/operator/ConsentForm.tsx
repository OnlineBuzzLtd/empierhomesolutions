"use client";

import { useState } from "react";
import type { ActiveDemoSession } from "@/modules/crm/demo-console/operator/OperatorPanel";
import { normaliseUkMobileToE164 } from "@/modules/crm/demo-console/normalise-uk-mobile";

// PECR-compliant consent capture form (ticket E-2). The displayed text
// is sent verbatim to the consent endpoint and stored on the
// demo_sessions row, so changing the wording here changes the
// downstream legal record. **Get this text reviewed by a lawyer before
// the first real prospect demo.**
//
// Wording rationale (placeholder — replace with lawyer-blessed copy):
//   - States WHO will receive the data (the demoing tenant).
//   - States WHAT will be sent (one SMS + one WhatsApp message
//     confirming the demo booking).
//   - States PURPOSE (demonstration only; no marketing follow-up).
//   - States RIGHT TO WITHDRAW (reply STOP, or ask the operator).
//   - Implicitly time-bounds the consent to this demo session.

const CONSENT_TEXT = [
  "I agree to receive one demonstration SMS and/or WhatsApp message from this CRM at the phone number I have provided, for the sole purpose of showing me a live booking confirmation during this in-person demo.",
  "",
  "I understand: (a) no marketing follow-up will be sent without further opt-in; (b) my data will be deleted at the end of this demo session via the operator's cleanup action; (c) I can withdraw consent at any time by asking the operator or replying STOP to any message received.",
].join("\n");

type ConsentFormProps = {
  onSessionStarted: (session: ActiveDemoSession) => void;
};

export function ConsentForm({ onSessionStarted }: ConsentFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      // Operators type natural UK shapes like "07779305853" — the
      // downstream Twilio + WhatsApp links need strict E.164. Normalise
      // before send so the prospect actually receives the SMS / WA
      // confirmation (and so the synthetic-number guard sees what
      // it expects).
      const normalisedPhone = normaliseUkMobileToE164(phone);
      const res = await fetch("/api/crm/demo/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prospect_name: name.trim(),
          prospect_phone: normalisedPhone,
          consent_text: CONSENT_TEXT,
          consent_acknowledged: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        session_id?: string;
        started_at?: string;
        prospect_name?: string;
        prospect_phone?: string;
        error?: string;
      };
      if (!res.ok || !body.session_id || !body.started_at) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSessionStarted({
        sessionId: body.session_id,
        startedAt: new Date(body.started_at),
        prospectName: body.prospect_name ?? name.trim(),
        prospectPhone: body.prospect_phone ?? phone.trim(),
      });
      setName("");
      setPhone("");
      setAcknowledged(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Consent capture failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length > 0 && phone.trim().length > 4 && acknowledged && !busy;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Prospect name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
          />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Mobile
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="07700 900123 or +447700900123"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
          />
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">Read this to the prospect:</p>
        <p className="mt-1 whitespace-pre-line">{CONSENT_TEXT}</p>
      </div>

      <label className="flex items-start gap-2 text-[11px] text-slate-700">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          I confirm I have read the above text to the prospect and they have verbally agreed.
        </span>
      </label>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? "Starting…" : "Start demo session"}
      </button>
    </form>
  );
}
