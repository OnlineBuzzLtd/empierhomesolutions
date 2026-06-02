"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/modules/crm/lib/supabase-browser";

// Client-side hook (ticket C-3). Subscribes to Supabase realtime inserts
// on the four CRM tables the Demo Console cares about, scoped to:
//   - is_test = true       (server-side filter — published changes only)
//   - tenant_id = X        (client-side filter — Supabase realtime only
//                           accepts one server-side filter per channel)
//   - created_at >= start  (client-side filter — only this session's rows)
//
// First realtime usage in the codebase. The pattern is intentionally
// kept narrow: read-only inserts, one channel, no diff merging. If a
// later feature needs UPDATE handling or a wider event surface, factor
// the channel construction out into a generic helper at that point.

export type DemoFeedRow = {
  id: string;
  table: DemoFeedTable;
  source?: string | null;
  channel?: string | null;
  created_at: string;
  // The row also carries the rest of its columns at runtime; we expose
  // them via `raw` so the renderer can pull a display label without us
  // having to enumerate every column on every table.
  raw: Record<string, unknown>;
};

export type DemoFeedStatus = "idle" | "connecting" | "live" | "error";
export type DemoFeedTable =
  | "customers"
  | "leads"
  | "jobs"
  | "appointments"
  | "job_survey_assessments"
  | "quotes"
  | "quote_versions"
  | "quote_acceptances"
  | "invoice_schedules"
  | "invoices"
  | "payments";

export type DemoSessionFeed = {
  customers: DemoFeedRow[];
  leads: DemoFeedRow[];
  jobs: DemoFeedRow[];
  appointments: DemoFeedRow[];
  commercial: DemoFeedRow[];
  status: DemoFeedStatus;
};

type UseDemoSessionFeedArgs = {
  // Null = no active demo session yet, hook idles. A Date = subscribe
  // and filter inserts to rows created on/after this moment.
  sessionStartedAt: Date | null;
  // The active tenant id. Pulled client-side from a server-rendered prop
  // (don't read auth on the client). Null = no tenant, hook idles.
  tenantId: string | null;
};

function toFeedRow(table: DemoFeedTable, raw: Record<string, unknown>): DemoFeedRow | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const createdAt = typeof raw.created_at === "string" ? raw.created_at : null;
  if (!id || !createdAt) return null;
  return {
    id,
    table,
    source: typeof raw.source === "string" ? raw.source : null,
    channel: typeof raw.channel === "string" ? raw.channel : null,
    created_at: createdAt,
    raw,
  };
}

// Decides whether a realtime row belongs in the active demo session's
// live pane. Pure — extracted so the filter logic can be unit-tested
// without spinning up a Supabase realtime client.
//
// As of 2026-05-18 this no longer requires is_test=true. The session
// window is still the display boundary, while demo-only webchat routes
// now tag their linked rows for cleanup after the real CRM records land.
export function shouldIncludeRow(
  raw: unknown,
  context: { tenantId: string; sessionStartIso: string },
): boolean {
  if (raw === null || typeof raw !== "object") return false;
  const row = raw as Record<string, unknown>;
  if (row.tenant_id !== context.tenantId) return false;
  if (typeof row.created_at !== "string") return false;
  if (row.created_at < context.sessionStartIso) return false;
  return true;
}

export function useDemoSessionFeed({
  sessionStartedAt,
  tenantId,
}: UseDemoSessionFeedArgs): DemoSessionFeed {
  const [customers, setCustomers] = useState<DemoFeedRow[]>([]);
  const [leads, setLeads] = useState<DemoFeedRow[]>([]);
  const [jobs, setJobs] = useState<DemoFeedRow[]>([]);
  const [appointments, setAppointments] = useState<DemoFeedRow[]>([]);
  const [commercial, setCommercial] = useState<DemoFeedRow[]>([]);
  const [status, setStatus] = useState<DemoFeedStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionStartedAt || !tenantId) {
      return;
    }
    // Capture as non-null locally so closures don't need re-narrowing.
    const activeTenantId: string = tenantId;

    const client = getSupabaseBrowserClient();
    if (!client) {
      queueMicrotask(() => setStatus("error"));
      return;
    }

    // Reset state for a fresh session so prior-session rows don't bleed
    // into the new live pane.
    queueMicrotask(() => {
      setStatus("connecting");
      setCustomers([]);
      setLeads([]);
      setJobs([]);
      setAppointments([]);
      setCommercial([]);
    });

    const sessionStartIso = sessionStartedAt.toISOString();

    // Filter discipline:
    //   - Server-side: tenant_id only. Live demo rows may arrive before
    //     the server-side tagger has marked them is_test=true, but we can
    //     still avoid subscribing to other tenants' changes.
    //   - Client-side: created_at >= sessionStartedAt remains the demo
    //     boundary. Starting a fresh session resets the window so prior
    //     rows don't leak in.
    //
    // Cleanup safety note: display is session-window scoped. Cleanup
    // still deletes is_test=true rows only; the demo webchat tagger is
    // responsible for marking the real CRM rows after each scripted turn.

    function pushIfMatch(
      table: DemoFeedTable,
      payloadRow: unknown,
      setList: React.Dispatch<React.SetStateAction<DemoFeedRow[]>>,
    ) {
      if (!shouldIncludeRow(payloadRow, { tenantId: activeTenantId, sessionStartIso })) return;
      const feedRow = toFeedRow(table, payloadRow as Record<string, unknown>);
      if (!feedRow) return;
      setList((prev) => {
        const withoutExisting = prev.filter(
          (existing) => !(existing.id === feedRow.id && existing.table === feedRow.table),
        );
        return [feedRow, ...withoutExisting];
      });
    }

    const tenantFilter = `tenant_id=eq.${activeTenantId}`;
    const channel = client
      .channel(`demo-console-feed:${activeTenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "customers", filter: tenantFilter },
        (payload) => pushIfMatch("customers", payload.new, setCustomers),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "leads", filter: tenantFilter },
        (payload) => pushIfMatch("leads", payload.new, setLeads),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "jobs", filter: tenantFilter },
        (payload) => pushIfMatch("jobs", payload.new, setJobs),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "appointments", filter: tenantFilter },
        (payload) => pushIfMatch("appointments", payload.new, setAppointments),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "job_survey_assessments", filter: tenantFilter },
        (payload) => pushIfMatch("job_survey_assessments", payload.new, setCommercial),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "quotes", filter: tenantFilter },
        (payload) => pushIfMatch("quotes", payload.new, setCommercial),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "quote_acceptances", filter: tenantFilter },
        (payload) => pushIfMatch("quote_acceptances", payload.new, setCommercial),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "invoice_schedules", filter: tenantFilter },
        (payload) => pushIfMatch("invoice_schedules", payload.new, setCommercial),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "invoices", filter: tenantFilter },
        (payload) => pushIfMatch("invoices", payload.new, setCommercial),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "payments", filter: tenantFilter },
        (payload) => pushIfMatch("payments", payload.new, setCommercial),
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("live");
        } else if (
          subscriptionStatus === "CHANNEL_ERROR" ||
          subscriptionStatus === "TIMED_OUT" ||
          subscriptionStatus === "CLOSED"
        ) {
          setStatus("error");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionStartedAt, tenantId]);

  const visibleStatus: DemoFeedStatus = sessionStartedAt && tenantId ? status : "idle";
  return { customers, leads, jobs, appointments, commercial, status: visibleStatus };
}
