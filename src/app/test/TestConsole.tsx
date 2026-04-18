"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RawRow = Record<string, unknown>;

type TenantChoice = { id: string; slug: string; name: string };

type FeedResponse = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    customerJourneysRuntimeTenantId: string | null;
  };
  runtime: {
    configured: boolean;
    link: Record<string, unknown> | null;
    surface: {
      tenant: { id: string; name: string; slug: string } | null;
      runtimeMode: "platform_ai" | "legacy_fallback" | null;
      bookingResourceCount: number;
      issues: string[];
      channels: {
        webchat: ChannelDetails;
        sms: ChannelDetails;
        whatsapp: ChannelDetails;
        voice: ChannelDetails;
      };
    } | null;
  };
  events: RawRow[];
  commands: RawRow[];
  conversations: RawRow[];
  recentRecords: RawRow[];
  serverNow: string;
  since: string | null;
  error?: string;
};

type ChannelDetails = {
  enabled: boolean;
  ready: boolean;
  displayNumber: string | null;
  deepLink: string | null;
  reason: string | null;
};

type LogEntry = {
  id: string;
  kind: "event" | "command" | "conversation" | "webchat" | "local";
  at: string;
  summary: string;
  raw: unknown;
};

type WebchatSession = {
  conversationId: string | null;
  messages: Array<{ id: string; body: string; direction: string; createdAt: string }>;
  lastReply: string | null;
  raw: unknown;
};

const POLL_INTERVAL_MS = 2000;

const channelMeta: Array<{
  key: "voice" | "sms" | "whatsapp" | "webchat";
  label: string;
  instructions: string[];
}> = [
  {
    key: "voice",
    label: "VOICE (phone call)",
    instructions: [
      "1. Copy the voice number below.",
      "2. From a real phone, dial it.",
      "3. Talk to the agent: say your name, postcode, what you need.",
      "4. Watch the live log below for call.start, transcript events, and any CRM booking/lead/appointment updates.",
    ],
  },
  {
    key: "sms",
    label: "SMS",
    instructions: [
      "1. Copy the SMS number below.",
      "2. From a real phone, text the agent (e.g. 'Hi, I need a boiler service').",
      "3. Reply to the agent as prompted (name, postcode, slot confirmation).",
      "4. Watch events land: inbound messages, AI replies, and any booking/CRM records.",
    ],
  },
  {
    key: "whatsapp",
    label: "WHATSAPP",
    instructions: [
      "1. Click the WhatsApp deep link (or copy the number).",
      "2. Send an opening message.",
      "3. Respond as prompted until the booking confirms.",
      "4. Watch conversation + booking records appear in the live log.",
    ],
  },
  {
    key: "webchat",
    label: "WEB CHAT",
    instructions: [
      "1. Fill in the opening message below.",
      "2. Click Start webchat.",
      "3. Send follow-up replies in the webchat panel.",
      "4. The live log will stream back events, commands, and CRM updates.",
    ],
  },
];

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return date.toISOString().replace("T", " ").replace("Z", "Z");
  } catch {
    return value;
  }
}

function stringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function asPayload(row: RawRow): Record<string, unknown> {
  const payload = row.payload;
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function shortId(value: unknown, n = 8): string {
  const s = asString(value);
  return s ? s.slice(0, n) : "—";
}

function joinDetails(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.length > 0)).join(" · ");
}

function summariseEvent(row: RawRow) {
  const type = asString(row.event_type) ?? "event";
  const status = asString(row.processing_status);
  const payload = asPayload(row);
  const channel = asString(payload.channel);
  const conv = shortId(row.aggregate_id);
  const nameFromParts = joinDetails([asString(payload.first_name), asString(payload.last_name)]) || null;
  const customerName = asString(payload.customerName) ?? nameFromParts;
  const phone = asString(payload.customerPhone) ?? asString(payload.identity_phone);
  const email = asString(payload.customerEmail) ?? asString(payload.identity_email);
  const slot = asString(payload.booking_slot_label);
  const service = asString(payload.serviceCategory);
  const postcode = asString(payload.servicePostcode);
  const bookingStart = asString(payload.booking_start_at);
  const message = asString(payload.message_summary);

  const details = joinDetails([
    channel,
    `conv ${conv}`,
    customerName,
    phone,
    email,
    service,
    postcode,
    slot,
    bookingStart ? `starts ${bookingStart}` : null,
    message,
    status,
  ]);

  return `${type}${details ? ` · ${details}` : ""}`;
}

function summariseCommand(row: RawRow) {
  const type = asString(row.command_type) ?? "command";
  const target = asString(row.target_system);
  const status = asString(row.delivery_status);
  const payload = asPayload(row);
  const channel = asString(payload.channel);
  const conv = shortId(row.aggregate_id);
  const linkReason = asString(payload.link_reason);
  const nameFromParts = joinDetails([asString(payload.first_name), asString(payload.last_name)]) || null;
  const customerName = asString(payload.customerName) ?? nameFromParts;
  const phone = asString(payload.customerPhone) ?? asString(payload.identity_phone);
  const email = asString(payload.customerEmail) ?? asString(payload.identity_email);
  const slot = asString(payload.booking_slot_label);

  const details = joinDetails([
    target ? `→ ${target}` : null,
    status,
    channel,
    `conv ${conv}`,
    linkReason ? `reason:${linkReason}` : null,
    customerName,
    phone,
    email,
    slot,
  ]);

  return `${type}${details ? ` · ${details}` : ""}`;
}

function summariseConversation(row: RawRow) {
  const channel = asString(row.latest_channel) ?? "unknown";
  const convId = shortId(row.conversation_id ?? row.id);
  const phone = asString(row.identity_phone);
  const email = asString(row.identity_email);
  const customer = asString(row.customer_id);
  const lead = asString(row.lead_id);
  const job = asString(row.job_id);
  const booking = asString(row.booking_appointment_id);
  const writes: string[] = [];
  if (customer) writes.push("customer");
  if (lead) writes.push("lead");
  if (job) writes.push("job");
  if (booking) writes.push("booking");
  const crmFlag = writes.length > 0 ? `crm:${writes.join(",")}` : "NO CRM WRITES";

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const slot = asString(meta.booking_slot_label);
  const message = asString(meta.message_summary);

  const details = joinDetails([
    channel,
    `conv ${convId}`,
    phone,
    email,
    slot,
    message,
    crmFlag,
  ]);

  return `conversation_link · ${details}`;
}

function rowKey(row: RawRow, fallback: string) {
  const candidate =
    row.event_id ??
    row.command_id ??
    row.id ??
    row.conversation_id ??
    row.idempotency_key ??
    `${fallback}-${row.occurred_at ?? row.issued_at ?? row.latest_event_at ?? Math.random()}`;
  return String(candidate);
}

function rowTime(row: RawRow) {
  return (row.occurred_at ?? row.issued_at ?? row.latest_event_at ?? row.updated_at ?? row.created_at ?? "") as string;
}

async function copy(value: string | null | undefined) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // ignore
  }
}

export function TestConsole() {
  const [tenants, setTenants] = useState<TenantChoice[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string>(() => {
    if (typeof window === "undefined") return "empire-home-solutions";
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant") ?? "empire-home-solutions";
  });
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sinceAnchor, setSinceAnchor] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const [webchatForm, setWebchatForm] = useState({ fullName: "Test User", email: "", openingMessage: "Hi, I need a boiler service this week." });
  const [webchatBody, setWebchatBody] = useState("");
  const [webchat, setWebchat] = useState<WebchatSession | null>(null);
  const [webchatBusy, setWebchatBusy] = useState(false);
  const [webchatError, setWebchatError] = useState<string | null>(null);

  const seenRef = useRef<Set<string>>(new Set());

  const appendLog = useCallback((entries: LogEntry[]) => {
    if (entries.length === 0) return;
    setLog((current) => {
      const existingIds = new Set(current.map((entry) => entry.id));
      const fresh = entries.filter((entry) => !existingIds.has(entry.id));
      if (fresh.length === 0) {
        return current;
      }
      return [...fresh, ...current].slice(0, 500);
    });
  }, []);

  const fetchFeed = useCallback(async () => {
    const params = new URLSearchParams();
    if (sinceAnchor) params.set("since", sinceAnchor);
    if (selectedTenantSlug) params.set("tenant", selectedTenantSlug);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/dev/test-feed${qs}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as FeedResponse;
    if (!res.ok) {
      setFeedError(data.error ?? `Feed request failed (${res.status}).`);
      return;
    }
    setFeedError(null);
    setFeed(data);

    const newEntries: LogEntry[] = [];

    for (const row of data.events ?? []) {
      const id = `evt:${rowKey(row, "event")}`;
      if (seenRef.current.has(id)) continue;
      seenRef.current.add(id);
      newEntries.push({ id, kind: "event", at: rowTime(row), summary: summariseEvent(row), raw: row });
    }
    for (const row of data.commands ?? []) {
      const id = `cmd:${rowKey(row, "command")}`;
      if (seenRef.current.has(id)) continue;
      seenRef.current.add(id);
      newEntries.push({ id, kind: "command", at: rowTime(row), summary: summariseCommand(row), raw: row });
    }
    for (const row of data.conversations ?? []) {
      const id = `conv:${rowKey(row, "conversation")}:${rowTime(row)}`;
      if (seenRef.current.has(id)) continue;
      seenRef.current.add(id);
      newEntries.push({ id, kind: "conversation", at: rowTime(row), summary: summariseConversation(row), raw: row });
    }

    if (newEntries.length > 0) {
      newEntries.sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));
      appendLog(newEntries);
    }
  }, [sinceAnchor, selectedTenantSlug, appendLog]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/tenants", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.tenants) return;
        setTenants(data.tenants as TenantChoice[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    seenRef.current = new Set();
    setLog([]);
    setSinceAnchor(null);
    setFeed(null);
    setFeedError(null);
    setWebchat(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (selectedTenantSlug && selectedTenantSlug !== "empire-home-solutions") {
        url.searchParams.set("tenant", selectedTenantSlug);
      } else {
        url.searchParams.delete("tenant");
      }
      window.history.replaceState({}, "", url.toString());
    }
    fetchFeed().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantSlug]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      fetchFeed().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [fetchFeed, paused]);

  const markSinceNow = useCallback(() => {
    const stamp = new Date().toISOString();
    setSinceAnchor(stamp);
    seenRef.current = new Set();
    setLog((current) => [
      {
        id: `local:reset:${stamp}`,
        kind: "local",
        at: stamp,
        summary: `armed — only showing events since ${stamp}`,
        raw: { reset: true, since: stamp },
      },
      ...current,
    ]);
  }, []);

  const clearLog = useCallback(() => {
    setLog([]);
  }, []);

  const channels = feed?.runtime.surface?.channels ?? null;

  async function handleStartWebchat() {
    setWebchatBusy(true);
    setWebchatError(null);
    try {
      const res = await fetch("/api/dev/webchat/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...webchatForm, tenant: selectedTenantSlug }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        session?: { conversation?: { id?: string }; messages?: WebchatSession["messages"]; replyMessage?: { body?: string } };
        error?: string;
      };
      if (!res.ok || !data.session?.conversation?.id) {
        throw new Error(data.error ?? "Failed to start webchat.");
      }
      const conversationId = data.session.conversation.id;
      const session: WebchatSession = {
        conversationId,
        messages: data.session.messages ?? [],
        lastReply: data.session.replyMessage?.body ?? null,
        raw: data.session,
      };
      setWebchat(session);
      appendLog([
        {
          id: `wc:start:${conversationId}`,
          kind: "webchat",
          at: new Date().toISOString(),
          summary: `webchat started · conversation ${conversationId.slice(0, 8)}`,
          raw: data.session,
        },
      ]);
    } catch (error) {
      setWebchatError(error instanceof Error ? error.message : "Failed to start webchat.");
    } finally {
      setWebchatBusy(false);
    }
  }

  async function handleSendWebchat() {
    if (!webchat?.conversationId || webchatBody.trim().length === 0) return;
    setWebchatBusy(true);
    setWebchatError(null);
    try {
      const res = await fetch("/api/dev/webchat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: webchat.conversationId, body: webchatBody }),
      });
      const data = (await res.json().catch(() => ({}))) as { session?: unknown; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send webchat message.");
      }
      appendLog([
        {
          id: `wc:msg:${Date.now()}`,
          kind: "webchat",
          at: new Date().toISOString(),
          summary: `webchat → "${webchatBody.slice(0, 60)}"`,
          raw: data.session,
        },
      ]);
      setWebchatBody("");
    } catch (error) {
      setWebchatError(error instanceof Error ? error.message : "Failed to send webchat message.");
    } finally {
      setWebchatBusy(false);
    }
  }

  const headerInfo = useMemo(() => {
    if (!feed) return null;
    return {
      crmTenantId: feed.tenant.id,
      runtimeTenantId: feed.runtime.link
        ? String((feed.runtime.link as Record<string, unknown>).customerjourneys_tenant_id ?? feed.tenant.customerJourneysRuntimeTenantId)
        : feed.tenant.customerJourneysRuntimeTenantId,
      runtimeMode: feed.runtime.surface?.runtimeMode ?? "—",
      configured: feed.runtime.configured,
      serverNow: feed.serverNow,
      issues: feed.runtime.surface?.issues ?? [],
    };
  }, [feed]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>LOCAL TEST CONSOLE</div>
            <h1 style={styles.h1}>
              {feed?.tenant?.name ?? "Tenant"}
              {feed?.tenant?.slug ? <span style={styles.subtle}> — {feed.tenant.slug}</span> : null}
            </h1>
            <div style={styles.subtle}>
              CRM + Agent channel test harness. Follow the instructions per channel and watch live CRM logs.
            </div>
          </div>
          <div style={styles.toolbar}>
            <label style={styles.subtle}>
              tenant:{" "}
              <select
                value={selectedTenantSlug}
                onChange={(e) => setSelectedTenantSlug(e.target.value)}
                style={{ ...styles.button, padding: "6px 10px" }}
              >
                {tenants.length === 0 ? (
                  <option value={selectedTenantSlug}>{selectedTenantSlug}</option>
                ) : (
                  tenants.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.name} ({t.slug})
                    </option>
                  ))
                )}
              </select>
            </label>
            <button type="button" onClick={markSinceNow} style={styles.buttonPrimary}>
              Arm test (reset log to now)
            </button>
            <button type="button" onClick={clearLog} style={styles.button}>
              Clear log
            </button>
            <button type="button" onClick={() => setPaused((p) => !p)} style={styles.button}>
              {paused ? "Resume polling" : "Pause polling"}
            </button>
          </div>
        </header>

        {feedError ? <div style={styles.errorBanner}>feed error: {feedError}</div> : null}

        <section style={styles.metaGrid}>
          <MetaCell label="crm_tenant_id" value={headerInfo?.crmTenantId ?? "—"} />
          <MetaCell label="customerjourneys_tenant_id" value={headerInfo?.runtimeTenantId ?? "—"} />
          <MetaCell label="runtime_mode" value={headerInfo?.runtimeMode ?? "—"} />
          <MetaCell label="runtime_configured" value={String(headerInfo?.configured ?? "—")} />
          <MetaCell label="server_now" value={formatTime(headerInfo?.serverNow)} />
          <MetaCell label="since_anchor" value={sinceAnchor ? formatTime(sinceAnchor) : "(none — showing most recent)"} />
        </section>

        {headerInfo?.issues?.length ? (
          <div style={styles.issues}>
            runtime issues:
            <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
              {headerInfo.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section style={styles.channels}>
          {channelMeta.map((meta) => {
            const info = channels?.[meta.key] ?? null;
            const status = info ? (info.ready ? "READY" : info.enabled ? "NOT_READY" : "DISABLED") : "UNKNOWN";
            const statusColor = info?.ready ? "#0a8a2a" : info?.enabled ? "#a66500" : "#7a1f1f";
            return (
              <div key={meta.key} style={styles.channelCard}>
                <div style={styles.channelHead}>
                  <div style={styles.channelTitle}>{meta.label}</div>
                  <div style={{ ...styles.badge, color: statusColor, borderColor: statusColor }}>{status}</div>
                </div>

                <div style={styles.channelBody}>
                  <Row label="number" value={info?.displayNumber ?? "—"} copyable />
                  <Row label="deep_link" value={info?.deepLink ?? "—"} linkable />
                  <Row label="enabled" value={String(info?.enabled ?? "—")} />
                  <Row label="reason" value={info?.reason ?? "—"} />
                </div>

                <ol style={styles.instructions}>
                  {meta.instructions.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>

                {meta.key === "webchat" ? (
                  <div style={styles.webchatBox}>
                    {!webchat?.conversationId ? (
                      <>
                        <label style={styles.label}>
                          opening_message
                          <textarea
                            value={webchatForm.openingMessage}
                            onChange={(e) => setWebchatForm((f) => ({ ...f, openingMessage: e.target.value }))}
                            style={styles.textarea}
                            rows={2}
                          />
                        </label>
                        <div style={styles.twoCol}>
                          <label style={styles.label}>
                            full_name
                            <input
                              value={webchatForm.fullName}
                              onChange={(e) => setWebchatForm((f) => ({ ...f, fullName: e.target.value }))}
                              style={styles.input}
                            />
                          </label>
                          <label style={styles.label}>
                            email
                            <input
                              value={webchatForm.email}
                              onChange={(e) => setWebchatForm((f) => ({ ...f, email: e.target.value }))}
                              style={styles.input}
                              placeholder="(optional)"
                            />
                          </label>
                        </div>
                        <button type="button" onClick={handleStartWebchat} disabled={webchatBusy} style={styles.buttonPrimary}>
                          {webchatBusy ? "starting…" : "Start webchat"}
                        </button>
                      </>
                    ) : (
                      <>
                        <Row label="conversation_id" value={webchat.conversationId} copyable />
                        <Row label="last_reply" value={webchat.lastReply ?? "—"} />
                        <label style={styles.label}>
                          send_message
                          <textarea
                            value={webchatBody}
                            onChange={(e) => setWebchatBody(e.target.value)}
                            style={styles.textarea}
                            rows={2}
                          />
                        </label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" onClick={handleSendWebchat} disabled={webchatBusy || !webchatBody.trim()} style={styles.buttonPrimary}>
                            {webchatBusy ? "sending…" : "Send"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWebchat(null);
                              setWebchatBody("");
                            }}
                            style={styles.button}
                          >
                            End session
                          </button>
                        </div>
                      </>
                    )}
                    {webchatError ? <div style={styles.errorInline}>{webchatError}</div> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        <CrmWritesPanel records={feed?.recentRecords ?? []} sinceAnchor={sinceAnchor} />

        <section style={styles.logSection}>
          <div style={styles.logHead}>
            <div style={styles.h2}>LIVE LOG ({log.length})</div>
            <div style={styles.subtle}>polls /api/dev/test-feed every {POLL_INTERVAL_MS}ms · {paused ? "paused" : "live"}</div>
          </div>

          {log.length === 0 ? (
            <div style={styles.empty}>no events yet. arm a test, then run it on your phone or in the webchat above.</div>
          ) : (
            <div style={styles.logList}>
              {log.map((entry) => (
                <details key={entry.id} style={styles.logItem}>
                  <summary style={styles.logSummary}>
                    <span style={{ ...styles.kindPill, background: kindColor(entry.kind) }}>{entry.kind}</span>
                    <span style={styles.logTime}>{formatTime(entry.at)}</span>
                    <span style={styles.logText}>{entry.summary}</span>
                  </summary>
                  <pre style={styles.pre}>{stringify(entry.raw)}</pre>
                </details>
              ))}
            </div>
          )}
        </section>

        <section style={styles.rawGrid}>
          <RawPanel title="recent events (raw)" rows={feed?.events ?? []} />
          <RawPanel title="recent commands (raw)" rows={feed?.commands ?? []} />
          <RawPanel title="recent conversations (raw)" rows={feed?.conversations ?? []} />
          <RawPanel title="recent linked records (customer / lead / job / booking)" rows={feed?.recentRecords ?? []} />
        </section>
      </div>
    </main>
  );
}

function kindColor(kind: LogEntry["kind"]) {
  switch (kind) {
    case "event":
      return "#1e3a8a";
    case "command":
      return "#6b21a8";
    case "conversation":
      return "#065f46";
    case "webchat":
      return "#9a3412";
    case "local":
      return "#374151";
  }
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metaCell}>
      <div style={styles.metaLabel}>{label}</div>
      <div style={styles.metaValue}>{value}</div>
    </div>
  );
}

function Row({ label, value, copyable, linkable }: { label: string; value: string; copyable?: boolean; linkable?: boolean }) {
  return (
    <div style={styles.kv}>
      <div style={styles.kvKey}>{label}</div>
      <div style={styles.kvVal}>
        {linkable && value && value !== "—" ? (
          <a href={value} target="_blank" rel="noreferrer" style={styles.link}>
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )}
        {copyable && value && value !== "—" ? (
          <button type="button" onClick={() => copy(value)} style={styles.copyBtn}>
            copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

type LinkedRecord = {
  link: {
    id?: string;
    conversation_id?: string;
    latest_channel?: string | null;
    identity_phone?: string | null;
    identity_email?: string | null;
    customer_id?: string | null;
    lead_id?: string | null;
    job_id?: string | null;
    callback_appointment_id?: string | null;
    booking_appointment_id?: string | null;
    latest_event_at?: string | null;
    updated_at?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  customer: { id?: string; full_name?: string | null; phone?: string | null; email?: string | null; postcode?: string | null } | null;
  lead: { id?: string; status?: string | null; source?: string | null; next_action_at?: string | null; updated_at?: string | null } | null;
  job: { id?: string; title?: string | null; status?: string | null; scheduled_date?: string | null } | null;
  callbackAppointment: { id?: string; type?: string | null; title?: string | null; starts_at?: string | null; ends_at?: string | null; status?: string | null } | null;
  bookingAppointment: { id?: string; type?: string | null; title?: string | null; starts_at?: string | null; ends_at?: string | null; status?: string | null } | null;
};

function CrmWritesPanel({ records, sinceAnchor }: { records: RawRow[]; sinceAnchor: string | null }) {
  const typed = records as unknown as LinkedRecord[];
  const filtered = sinceAnchor
    ? typed.filter((r) => {
        const t = r.link?.latest_event_at ?? r.link?.updated_at ?? null;
        return t ? t >= sinceAnchor : false;
      })
    : typed;

  return (
    <section style={styles.crmSection}>
      <div style={styles.logHead}>
        <div style={styles.h2}>
          CRM WRITES ({filtered.length}
          {sinceAnchor ? ` since anchor` : ` · latest ${typed.length}`})
        </div>
        <div style={styles.subtle}>
          rows from platform_conversation_links joined to customers / leads / jobs / appointments
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>
          no conversation-link rows for tenant 1{sinceAnchor ? " since the arm anchor" : ""}. run a test to generate one.
        </div>
      ) : (
        <div style={styles.crmList}>
          {filtered.map((record, index) => {
            const link = record.link ?? {};
            const writes: string[] = [];
            if (link.customer_id) writes.push("customer");
            if (link.lead_id) writes.push("lead");
            if (link.job_id) writes.push("job");
            if (link.booking_appointment_id) writes.push("booking");
            if (link.callback_appointment_id) writes.push("callback");
            const hasWrites = writes.length > 0;
            const meta = link.metadata ?? {};

            return (
              <details
                key={String(link.id ?? link.conversation_id ?? `idx-${index}`)}
                style={styles.crmCard}
                open={!sinceAnchor ? false : true}
              >
                <summary style={styles.crmSummary}>
                  <span
                    style={{
                      ...styles.kindPill,
                      background: hasWrites ? "#065f46" : "#7a1f1f",
                      minWidth: 130,
                    }}
                  >
                    {hasWrites ? writes.join("+") : "NO CRM WRITES"}
                  </span>
                  <span style={styles.logTime}>{formatTime(link.latest_event_at ?? link.updated_at ?? null)}</span>
                  <span style={styles.logText}>
                    {joinDetails([
                      asString(link.latest_channel),
                      `conv ${shortId(link.conversation_id)}`,
                      asString(link.identity_phone),
                      asString(link.identity_email),
                      asString(record.customer?.full_name),
                      asString((meta as Record<string, unknown>).booking_slot_label),
                    ])}
                  </span>
                </summary>

                <div style={styles.crmBody}>
                  <CrmBlock
                    title="conversation_link"
                    rows={[
                      ["conversation_id", String(link.conversation_id ?? "—")],
                      ["channel", asString(link.latest_channel) ?? "—"],
                      ["identity_phone", asString(link.identity_phone) ?? "—"],
                      ["identity_email", asString(link.identity_email) ?? "—"],
                      ["latest_event_at", formatTime(link.latest_event_at)],
                      ["updated_at", formatTime(link.updated_at)],
                    ]}
                  />
                  <CrmBlock
                    title={`customer${record.customer ? "" : " · (none)"}`}
                    rows={
                      record.customer
                        ? [
                            ["id", String(record.customer.id ?? "—")],
                            ["full_name", record.customer.full_name ?? "—"],
                            ["phone", record.customer.phone ?? "—"],
                            ["email", record.customer.email ?? "—"],
                            ["postcode", record.customer.postcode ?? "—"],
                          ]
                        : []
                    }
                  />
                  <CrmBlock
                    title={`lead${record.lead ? "" : " · (none)"}`}
                    rows={
                      record.lead
                        ? [
                            ["id", String(record.lead.id ?? "—")],
                            ["status", record.lead.status ?? "—"],
                            ["source", record.lead.source ?? "—"],
                            ["next_action_at", formatTime(record.lead.next_action_at)],
                          ]
                        : []
                    }
                  />
                  <CrmBlock
                    title={`job${record.job ? "" : " · (none)"}`}
                    rows={
                      record.job
                        ? [
                            ["id", String(record.job.id ?? "—")],
                            ["title", record.job.title ?? "—"],
                            ["status", record.job.status ?? "—"],
                            ["scheduled_date", record.job.scheduled_date ?? "—"],
                          ]
                        : []
                    }
                  />
                  <CrmBlock
                    title={`booking_appointment${record.bookingAppointment ? "" : " · (none)"}`}
                    rows={
                      record.bookingAppointment
                        ? [
                            ["id", String(record.bookingAppointment.id ?? "—")],
                            ["title", record.bookingAppointment.title ?? "—"],
                            ["type", record.bookingAppointment.type ?? "—"],
                            ["status", record.bookingAppointment.status ?? "—"],
                            ["starts_at", formatTime(record.bookingAppointment.starts_at)],
                            ["ends_at", formatTime(record.bookingAppointment.ends_at)],
                          ]
                        : []
                    }
                  />
                  <CrmBlock
                    title={`callback_appointment${record.callbackAppointment ? "" : " · (none)"}`}
                    rows={
                      record.callbackAppointment
                        ? [
                            ["id", String(record.callbackAppointment.id ?? "—")],
                            ["title", record.callbackAppointment.title ?? "—"],
                            ["type", record.callbackAppointment.type ?? "—"],
                            ["status", record.callbackAppointment.status ?? "—"],
                            ["starts_at", formatTime(record.callbackAppointment.starts_at)],
                            ["ends_at", formatTime(record.callbackAppointment.ends_at)],
                          ]
                        : []
                    }
                  />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CrmBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div style={styles.crmBlock}>
      <div style={styles.crmBlockTitle}>{title}</div>
      {rows.length === 0 ? (
        <div style={styles.subtle}>—</div>
      ) : (
        rows.map(([k, v]) => (
          <div key={k} style={styles.kv}>
            <div style={styles.kvKey}>{k}</div>
            <div style={styles.kvVal}>
              <span>{v}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function RawPanel({ title, rows }: { title: string; rows: RawRow[] }) {
  return (
    <details style={styles.rawPanel} open={rows.length > 0 && rows.length <= 5}>
      <summary style={styles.rawSummary}>
        {title} ({rows.length})
      </summary>
      {rows.length === 0 ? (
        <div style={styles.empty}>(empty)</div>
      ) : (
        <pre style={styles.pre}>{JSON.stringify(rows, null, 2)}</pre>
      )}
    </details>
  );
}

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#f5f5f5",
    color: "#111",
    minHeight: "100vh",
    fontFamily: mono,
    fontSize: 13,
    lineHeight: 1.45,
    padding: "16px 16px 64px",
  },
  container: {
    maxWidth: 1400,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid #ccc",
    paddingBottom: 12,
  },
  eyebrow: { letterSpacing: 2, fontSize: 11, color: "#666" },
  h1: { fontSize: 20, margin: "4px 0 2px", fontWeight: 700 },
  subtle: { color: "#555", fontSize: 12 },
  toolbar: { display: "flex", gap: 8, flexWrap: "wrap" },
  button: {
    background: "#fff",
    border: "1px solid #999",
    padding: "6px 10px",
    fontFamily: mono,
    fontSize: 12,
    cursor: "pointer",
  },
  buttonPrimary: {
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    padding: "6px 10px",
    fontFamily: mono,
    fontSize: 12,
    cursor: "pointer",
  },
  errorBanner: {
    background: "#ffecec",
    border: "1px solid #c33",
    padding: "6px 10px",
    color: "#8a1a1a",
  },
  errorInline: {
    color: "#8a1a1a",
    marginTop: 6,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 8,
  },
  metaCell: {
    background: "#fff",
    border: "1px solid #ccc",
    padding: "6px 10px",
  },
  metaLabel: { color: "#666", fontSize: 11, letterSpacing: 1 },
  metaValue: { fontSize: 13, wordBreak: "break-all" },
  issues: {
    background: "#fff7e0",
    border: "1px solid #c9a227",
    padding: "8px 10px",
  },
  channels: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
  },
  channelCard: {
    background: "#fff",
    border: "1px solid #bbb",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  channelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  channelTitle: { fontWeight: 700 },
  badge: {
    fontSize: 11,
    border: "1px solid",
    padding: "2px 6px",
    letterSpacing: 1,
  },
  channelBody: { display: "flex", flexDirection: "column", gap: 2 },
  kv: { display: "flex", gap: 6 },
  kvKey: { color: "#666", minWidth: 110 },
  kvVal: { flex: 1, wordBreak: "break-all", display: "flex", gap: 8, alignItems: "baseline" },
  copyBtn: {
    background: "#eee",
    border: "1px solid #999",
    fontFamily: mono,
    fontSize: 10,
    padding: "0 6px",
    cursor: "pointer",
  },
  link: { color: "#1a5fb4", textDecoration: "underline" },
  instructions: {
    margin: 0,
    paddingLeft: 18,
    color: "#333",
    background: "#fafafa",
    border: "1px dashed #ccc",
    padding: "6px 10px 6px 28px",
    listStyleType: "none",
  },
  webchatBox: {
    borderTop: "1px dashed #ccc",
    paddingTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: { display: "flex", flexDirection: "column", fontSize: 11, color: "#555", gap: 2 },
  input: {
    fontFamily: mono,
    fontSize: 12,
    padding: 4,
    border: "1px solid #999",
  },
  textarea: {
    fontFamily: mono,
    fontSize: 12,
    padding: 4,
    border: "1px solid #999",
    resize: "vertical",
  },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  logSection: {
    background: "#fff",
    border: "1px solid #bbb",
    padding: 10,
  },
  logHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottom: "1px solid #ccc",
    paddingBottom: 6,
    marginBottom: 8,
  },
  h2: { fontWeight: 700, fontSize: 14 },
  empty: { color: "#888", padding: "6px 2px" },
  logList: { display: "flex", flexDirection: "column", gap: 2 },
  logItem: { borderBottom: "1px solid #eee" },
  logSummary: {
    cursor: "pointer",
    display: "flex",
    gap: 8,
    padding: "4px 0",
    alignItems: "center",
    listStyle: "none",
  },
  kindPill: {
    color: "#fff",
    fontSize: 10,
    letterSpacing: 1,
    padding: "1px 6px",
    minWidth: 72,
    textAlign: "center",
  },
  logTime: { color: "#666", minWidth: 190 },
  logText: { color: "#111", flex: 1 },
  pre: {
    background: "#111",
    color: "#e5e5e5",
    padding: 8,
    margin: 0,
    overflowX: "auto",
    fontSize: 11,
    lineHeight: 1.4,
  },
  rawGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 8,
  },
  rawPanel: {
    background: "#fff",
    border: "1px solid #bbb",
    padding: 8,
  },
  crmSection: {
    background: "#fff",
    border: "1px solid #bbb",
    padding: 10,
  },
  crmList: { display: "flex", flexDirection: "column", gap: 6 },
  crmCard: {
    border: "1px solid #ddd",
    background: "#fafafa",
  },
  crmSummary: {
    cursor: "pointer",
    display: "flex",
    gap: 8,
    padding: "6px 8px",
    alignItems: "center",
    listStyle: "none",
  },
  crmBody: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 8,
    padding: 8,
    borderTop: "1px solid #ddd",
    background: "#fff",
  },
  crmBlock: {
    border: "1px solid #eee",
    padding: 6,
    background: "#fcfcfc",
  },
  crmBlockTitle: {
    fontWeight: 700,
    fontSize: 11,
    color: "#555",
    letterSpacing: 1,
    marginBottom: 4,
    borderBottom: "1px solid #eee",
    paddingBottom: 2,
  },
  rawSummary: {
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1,
  },
};
