"use client";

import { useState } from "react";

export function PublicLinkPanel({
  quoteId,
  initialToken,
  initialExpiresAt,
}: {
  quoteId: string;
  initialToken?: string | null;
  initialExpiresAt?: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/q/${token}` : null;

  async function mint() {
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/crm/quotes/${quoteId}/public-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_days: 30 }),
    });
    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    setSubmitting(false);
    if (!response.ok) {
      setError(result.error ?? "Failed to mint link.");
      return;
    }
    setToken(result.token);
    setExpiresAt(result.expires_at);
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      {url ? (
        <>
          <p className="break-all rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">{url}</p>
          {expiresAt ? <p className="text-xs text-slate-500">Expires {new Date(expiresAt).toLocaleString("en-GB")}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={mint}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed"
            >
              {submitting ? "Rotating…" : "Rotate token"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={mint}
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "Generating…" : "Generate public link"}
        </button>
      )}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
