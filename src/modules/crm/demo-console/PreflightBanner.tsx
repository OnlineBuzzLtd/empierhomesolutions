"use client";

import { useEffect, useState } from "react";

// Preflight banner (ticket F-2). Polls /api/crm/demo/preflight every
// 60s and surfaces the result as a compact strip at the top of
// /demo/run. The first check runs on mount so the operator sees status
// before they start a demo.
//
// Used as a presentation layer only — the DemoRunStage doesn't disable
// triggers based on this banner. Disabling lives in the operator panel
// when the kill switch is set (E-6). The banner's job is to surface
// problems before the operator stands in front of a prospect.

type CheckStatus = "ok" | "warn" | "fail" | "skipped";

type PreflightResponse = {
  env: { status: CheckStatus; detail: string };
  supabase: { status: CheckStatus; detail: string };
  guard: { status: CheckStatus; detail: string };
  twilio: { status: CheckStatus; detail: string; score: number | null };
  checked_at: string;
};

type BannerState =
  | { phase: "loading" }
  | { phase: "loaded"; data: PreflightResponse }
  | { phase: "error"; message: string };

const POLL_MS = 60_000;

export function PreflightBanner() {
  const [state, setState] = useState<BannerState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/crm/demo/preflight", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setState({ phase: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as PreflightResponse;
        if (!cancelled) setState({ phase: "loaded", data });
      } catch (caught) {
        if (!cancelled) {
          setState({
            phase: "error",
            message: caught instanceof Error ? caught.message : "Network error",
          });
        }
      }
    }
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (state.phase === "loading") {
    return (
      <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-600">
        Preflight…
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="rounded-lg bg-rose-100 px-3 py-1.5 text-[11px] font-semibold text-rose-700">
        Preflight failed · {state.message}
      </div>
    );
  }

  const { data } = state;
  const checks = [
    { label: "env", status: data.env.status, detail: data.env.detail },
    { label: "supabase", status: data.supabase.status, detail: data.supabase.detail },
    { label: "guard", status: data.guard.status, detail: data.guard.detail },
    { label: "twilio", status: data.twilio.status, detail: data.twilio.detail },
  ] as const;

  const overall: CheckStatus = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  const overallClass =
    overall === "fail"
      ? "bg-rose-100 text-rose-700"
      : overall === "warn"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-700";

  const checkedAt = new Date(data.checked_at).toLocaleTimeString();

  return (
    <details className={`group rounded-lg px-3 py-1.5 text-[11px] ${overallClass}`}>
      <summary className="cursor-pointer list-none font-semibold uppercase tracking-[0.12em]">
        Preflight · {overall} · {checkedAt}
      </summary>
      <ul className="mt-2 space-y-1">
        {checks.map((c) => (
          <li key={c.label} className="flex items-baseline gap-2">
            <span className="font-semibold">{c.label}</span>
            <StatusDot status={c.status} />
            <span className="text-[10px] opacity-80">{c.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StatusDot({ status }: { status: CheckStatus }) {
  const cls =
    status === "ok"
      ? "bg-emerald-500"
      : status === "warn"
        ? "bg-amber-500"
        : status === "fail"
          ? "bg-rose-500"
          : "bg-slate-400";
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}
