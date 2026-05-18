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
  source?: string | null;
  channel?: string | null;
  created_at: string;
  // The row also carries the rest of its columns at runtime; we expose
  // them via `raw` so the renderer can pull a display label without us
  // having to enumerate every column on every table.
  raw: Record<string, unknown>;
};

export type DemoFeedStatus = "idle" | "connecting" | "live" | "error";

export type DemoSessionFeed = {
  customers: DemoFeedRow[];
  leads: DemoFeedRow[];
  jobs: DemoFeedRow[];
  appointments: DemoFeedRow[];
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

function toFeedRow(raw: Record<string, unknown>): DemoFeedRow | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const createdAt = typeof raw.created_at === "string" ? raw.created_at : null;
  if (!id || !createdAt) return null;
  return {
    id,
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
// As of 2026-05-18 this no longer requires is_test=true: webchat
// bookings through the CJ runtime never carry that flag (the public
// /api/public/webchat/sessions endpoint hardcodes source=empire_lp
// and doesn't accept is_test). The session-started-at window is the
// scoping mechanism instead.
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
  const [status, setStatus] = useState<DemoFeedStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionStartedAt || !tenantId) {
      setStatus("idle");
      return;
    }
    // Capture as non-null locally so closures don't need re-narrowing.
    const activeTenantId: string = tenantId;

    const client = getSupabaseBrowserClient();
    if (!client) {
      setStatus("error");
      return;
    }

    setStatus("connecting");
    // Reset state for a fresh session so prior-session rows don't bleed
    // into the new live pane.
    setCustomers([]);
    setLeads([]);
    setJobs([]);
    setAppointments([]);

    const sessionStartIso = sessionStartedAt.toISOString();

    // Filter discipline as of 2026-05-18:
    //   - Server-side: NO `is_test` filter. The webchat path through the
    //     CJ runtime (and other in-flight refactors) creates real
    //     customer/lead/job/appointment rows for the duration of the
    //     conversation that may or may not carry is_test=true. Earlier
    //     versions of this hook filtered server-side on is_test=true
    //     and missed every webchat booking in the live pane.
    //   - Client-side: tenant_id + created_at >= sessionStartedAt is
    //     enough scoping — the session window is the demo boundary, and
    //     starting a fresh session resets the window so prior rows
    //     don't leak in.
    //
    // Cleanup safety note: this widened filter only affects what the
    // pane DISPLAYS. The cleanup endpoint still deletes is_test=true
    // rows only. Webchat rows that surface here will NOT be wiped by
    // end-of-session cleanup until E-7 (is_test propagation through
    // the webchat path) lands. The webchat tile footer + module
    // README document this so operators know to expect accumulation.

    function pushIfMatch(
      payloadRow: unknown,
      setList: React.Dispatch<React.SetStateAction<DemoFeedRow[]>>,
    ) {
      if (!shouldIncludeRow(payloadRow, { tenantId: activeTenantId, sessionStartIso })) return;
      const feedRow = toFeedRow(payloadRow as Record<string, unknown>);
      if (!feedRow) return;
      setList((prev) => {
        if (prev.some((existing) => existing.id === feedRow.id)) return prev;
        return [feedRow, ...prev];
      });
    }

    const channel = client
      .channel(`demo-console-feed:${activeTenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "crm", table: "customers" },
        (payload) => pushIfMatch(payload.new, setCustomers),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "crm", table: "leads" },
        (payload) => pushIfMatch(payload.new, setLeads),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "crm", table: "jobs" },
        (payload) => pushIfMatch(payload.new, setJobs),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "crm", table: "appointments" },
        (payload) => pushIfMatch(payload.new, setAppointments),
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

  return { customers, leads, jobs, appointments, status };
}
