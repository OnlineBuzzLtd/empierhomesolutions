"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QuoteStatus } from "@/modules/crm/types";

export function PublicQuoteActions({ token, status }: { token: string; status: QuoteStatus }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (status === "accepted") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        This quote has been accepted. Thank you!
      </div>
    );
  }
  if (status === "declined") {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        This quote has been declined. Please contact us if you&apos;d like to discuss alternatives.
      </div>
    );
  }
  if (status !== "sent") {
    return null;
  }

  async function accept() {
    if (!name.trim() || !agree) return;
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/public/quotes/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted_by_name: name, accepted_by_email: email || null }),
    });
    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    setSubmitting(false);
    if (!response.ok) {
      setError(result.error ?? "Failed to accept.");
      return;
    }
    setSuccess("Thank you — your acceptance has been recorded.");
    router.refresh();
  }

  async function reject() {
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/public/quotes/${token}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || null }),
    });
    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    setSubmitting(false);
    if (!response.ok) {
      setError(result.error ?? "Failed to reject.");
      return;
    }
    setSuccess("Your response has been recorded.");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      {success ? (
        <p className="text-sm text-emerald-700">{success}</p>
      ) : showReject ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Reject quote</h3>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reject}
              disabled={submitting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Confirm rejection"}
            </button>
            <button type="button" onClick={() => setShowReject(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Accept this quote</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              type="email"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>
              I confirm I have read and accept this quote and the supplier&apos;s terms. Acceptance is recorded with my
              name, IP address and timestamp.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={submitting || !name.trim() || !agree}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Submitting…" : "Accept quote"}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Reject quote
            </button>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
