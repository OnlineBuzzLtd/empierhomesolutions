"use client";

import { Bell, ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/modules/crm/lib/supabase-browser";
import { CrmInstantLink, invalidateCrmClientCache, useCrmClientRuntime } from "@/modules/crm/components/client/CrmClientRuntime";
import type { LeadWithRelations } from "@/modules/crm/types";
import {
  newEnquiryOverlayHref,
  queueNewEnquiry,
  shouldShowNewEnquiryInsert,
  toRealtimeLeadInsert,
  type RealtimeLeadInsert,
} from "@/modules/crm/components/client/new-enquiry-overlay-state";

type OverlayItem = {
  id: string;
  fallback: RealtimeLeadInsert;
  lead: LeadWithRelations | null;
  loading: boolean;
};

function displayText(item: OverlayItem) {
  const lead = item.lead;
  const title = lead?.customer?.full_name ?? "New enquiry";
  const contact = [lead?.customer?.phone, lead?.customer?.email].filter(Boolean).join(" · ");
  const source = lead?.source ?? item.fallback.source ?? "CRM enquiry";
  const service = [lead?.service?.name, lead?.job_type?.name].filter(Boolean).join(" · ");
  const problem = lead?.problem_description ?? lead?.notes ?? item.fallback.problem_description ?? item.fallback.notes;

  return {
    title,
    meta: [contact, source].filter(Boolean).join(" · "),
    service,
    problem,
  };
}

export function NewEnquiryOverlay() {
  const { tenantId } = useCrmClientRuntime();
  const [items, setItems] = useState<OverlayItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const itemsRef = useRef(items);
  const dismissedIdsRef = useRef(dismissedIds);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    dismissedIdsRef.current = dismissedIds;
  }, [dismissedIds]);

  const loadLead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/crm/leads/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => null);
      const lead = body?.ok ? (body.lead as LeadWithRelations | undefined) : null;
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, lead: lead ?? item.lead, loading: false } : item)),
      );
    } catch {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, loading: false } : item)));
    }
  }, []);

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    const tenantFilter = `tenant_id=eq.${tenantId}`;
    const channel = client
      .channel(`crm-new-enquiries:${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "crm", table: "leads", filter: tenantFilter },
        (payload) => {
          const fallback = toRealtimeLeadInsert(payload.new);
          const queuedIds = new Set(itemsRef.current.map((item) => item.id));
          if (
            !fallback ||
            !shouldShowNewEnquiryInsert(payload.new, {
              tenantId,
              dismissedIds: dismissedIdsRef.current,
              queuedIds,
            })
          ) {
            return;
          }

          invalidateCrmClientCache(["/api/crm/leads", "/api/crm/dashboard/summary"]);
          setItems((current) => queueNewEnquiry(current, { id: fallback.id, fallback, lead: null, loading: true }));
          void loadLead(fallback.id);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [loadLead, tenantId]);

  const current = items[0] ?? null;
  const text = useMemo(() => (current ? displayText(current) : null), [current]);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((currentIds) => new Set(currentIds).add(id));
    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
  }, []);

  if (!current || !text) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed right-4 top-4 z-[90] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-cyan-200 bg-white shadow-xl shadow-slate-900/15"
    >
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{text.title}</p>
              <p className="mt-1 text-xs text-slate-500">{text.meta || "New CRM enquiry"}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(current.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss new enquiry alert"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {text.service ? <p className="mt-2 text-xs font-medium text-slate-700">{text.service}</p> : null}
          {text.problem ? <p className="mt-2 line-clamp-2 text-xs text-slate-600">{text.problem}</p> : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            <CrmInstantLink
              href={newEnquiryOverlayHref(current.id)}
              onClick={() => dismiss(current.id)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Review enquiry
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </CrmInstantLink>
            <div className="text-xs text-slate-500">
              {current.loading ? "Loading details..." : items.length > 1 ? `${items.length - 1} more waiting` : "Just now"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
