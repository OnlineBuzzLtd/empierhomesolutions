"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { PlatformConversationRecord } from "@/modules/platform/lib/repository";
import type { ChannelTestRuntimeSnapshot, CustomerJourneysRuntimeSurface } from "@/modules/crm/lib/customerjourneys";

type RuntimeSnapshot = ChannelTestRuntimeSnapshot;

type WebchatMessage = {
  id: string;
  body: string;
  direction: "inbound" | "outbound" | "system";
  createdAt: string;
};

type WebchatSessionState = {
  conversation: {
    id: string;
  };
  messages: WebchatMessage[];
  bookingState: {
    currentState: string;
  } | null;
  replyMessage: WebchatMessage | null;
};

type WebchatTurnResponse = {
  message: WebchatMessage;
  replyMessage: WebchatMessage | null;
};

type CreateFormState = {
  fullName: string;
  email: string;
  openingMessage: string;
};

const emptyCreateForm: CreateFormState = {
  fullName: "",
  email: "",
  openingMessage: "",
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeDirection(value: unknown): WebchatMessage["direction"] {
  return value === "outbound" || value === "system" ? value : "inbound";
}

function normalizeWebchatMessage(value: unknown): WebchatMessage | null {
  const record = asRecord(value);
  const id = asString(record.id);
  const body = asString(record.body);
  if (!id || !body) {
    return null;
  }

  return {
    id,
    body,
    direction: normalizeDirection(record.direction),
    createdAt: asString(record.createdAt) ?? asString(record.created_at) ?? new Date().toISOString(),
  };
}

function normalizeWebchatSession(value: unknown): WebchatSessionState | null {
  const record = asRecord(value);
  const conversation = asRecord(record.conversation);
  const conversationId = asString(conversation.id);
  if (!conversationId) {
    return null;
  }

  const messages = Array.isArray(record.messages) ? record.messages.map(normalizeWebchatMessage).filter((message): message is WebchatMessage => message !== null) : [];
  const replyMessage = normalizeWebchatMessage(record.replyMessage);
  const dedupedMessages =
    replyMessage && !messages.some((message) => message.id === replyMessage.id)
      ? [...messages, replyMessage]
      : messages;
  const bookingStateRecord = asRecord(record.bookingState);

  return {
    conversation: {
      id: conversationId,
    },
    messages: dedupedMessages,
    bookingState: asString(bookingStateRecord.currentState)
      ? {
          currentState: String(bookingStateRecord.currentState),
        }
      : null,
    replyMessage,
  };
}

function normalizeWebchatTurnResponse(value: unknown): WebchatTurnResponse | null {
  const record = asRecord(value);
  const message = normalizeWebchatMessage(record.message);
  if (!message) {
    return null;
  }

  return {
    message,
    replyMessage: normalizeWebchatMessage(record.replyMessage),
  };
}

function mergeWebchatMessages(existing: WebchatMessage[], incoming: WebchatMessage[]) {
  const deduped = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) {
    deduped.set(message.id, message);
  }
  return [...deduped.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function parseJson<T>(response: Response) {
  return response.json().catch(() => ({})) as Promise<T>;
}

function formatChannelLabel(channel: "webchat" | "sms" | "whatsapp" | "voice") {
  switch (channel) {
    case "webchat":
      return "Web";
    case "sms":
      return "SMS";
    case "whatsapp":
      return "WhatsApp";
    case "voice":
      return "Phone";
  }
}

function formatRuntimeMode(mode: CustomerJourneysRuntimeSurface["runtimeMode"]) {
  return mode === "legacy_fallback" ? "Legacy fallback" : mode === "platform_ai" ? "Platform AI" : "Unknown";
}

function formatChannelTone(ready: boolean) {
  return ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
}

function formatConversationChannel(value: string | null) {
  if (value === "voice") {
    return "Phone";
  }
  if (value === "webchat") {
    return "Web";
  }
  if (value === "whatsapp") {
    return "WhatsApp";
  }
  if (value === "sms") {
    return "SMS";
  }
  return "Unknown";
}

function formatRecordTitle(record: PlatformConversationRecord) {
  return record.customer?.full_name ?? record.job?.title ?? record.bookingAppointment?.title ?? "Unlinked conversation";
}

function formatRecordMeta(record: PlatformConversationRecord) {
  return [record.lead?.status ? `Lead ${record.lead.status}` : null, record.bookingAppointment?.title ?? null]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function buildIdentifierValue(form: CreateFormState) {
  return form.email.trim() || `crm-webchat-${Date.now()}`;
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(value);
  return true;
}

export function LiveFrontDeskTester({ initialSnapshot }: { initialSnapshot: RuntimeSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [webchatSession, setWebchatSession] = useState<WebchatSessionState | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm);
  const [messageBody, setMessageBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const runtime = snapshot.runtime;
  const webchatReady = Boolean(runtime?.channels.webchat.ready);
  const runtimeIssues = runtime?.issues ?? [];
  const activeConversationId = webchatSession?.conversation.id ?? null;

  async function refreshSnapshot() {
    const response = await fetch("/api/crm/channel-test/runtime", {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });
    const data = await parseJson<{ snapshot?: RuntimeSnapshot; error?: string }>(response);
    if (!response.ok || !data.snapshot) {
      throw new Error(data.error ?? "Failed to refresh runtime state.");
    }
    setSnapshot(data.snapshot);
    return data.snapshot;
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshSnapshot().catch(() => undefined);
    }, 12000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!copyNotice) {
      return;
    }

    const timer = window.setTimeout(() => setCopyNotice(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  const channelCards = useMemo(
    () =>
      runtime
        ? ([
            ["webchat", runtime.channels.webchat],
            ["sms", runtime.channels.sms],
            ["whatsapp", runtime.channels.whatsapp],
            ["voice", runtime.channels.voice],
          ] as const)
        : [],
    [runtime],
  );

  async function handleCreateWebchatSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/crm/channel-test/webchat/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          identifierValue: buildIdentifierValue(createForm),
          fullName: createForm.fullName,
          email: createForm.email,
          openingMessage: createForm.openingMessage,
        }),
      });
      const data = await parseJson<{ session?: unknown; error?: string }>(response);
      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "Failed to create the linked webchat session.");
      }

      const nextSession = normalizeWebchatSession(data.session);
      if (!nextSession) {
        throw new Error("CustomerJourneys returned an invalid webchat session.");
      }

      setWebchatSession(nextSession);
      setCreateForm(emptyCreateForm);
      await refreshSnapshot().catch(() => undefined);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create the linked webchat session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversationId || messageBody.trim().length === 0) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/crm/channel-test/webchat/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          body: messageBody,
        }),
      });
      const data = await parseJson<{ session?: unknown; error?: string }>(response);
      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "Failed to send the linked webchat message.");
      }

      const nextSession = normalizeWebchatSession(data.session);
      if (nextSession) {
        setWebchatSession(nextSession);
      } else {
        const turn = normalizeWebchatTurnResponse(data.session);
        if (!turn || !webchatSession) {
          throw new Error("CustomerJourneys returned an invalid webchat response.");
        }

        setWebchatSession({
          ...webchatSession,
          messages: mergeWebchatMessages(
            webchatSession.messages,
            [turn.message, turn.replyMessage].filter((message): message is WebchatMessage => message !== null),
          ),
          replyMessage: turn.replyMessage,
        });
      }
      setMessageBody("");
      window.setTimeout(() => {
        refreshSnapshot().catch(() => undefined);
      }, 800);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send the linked webchat message.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(value: string | null) {
    if (!value) {
      return;
    }

    const copied = await copyToClipboard(value).catch(() => false);
    setCopyNotice(copied ? "Copied" : "Copy failed");
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {copyNotice ? <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{copyNotice}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Linked Runtime</p>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  snapshot.usingFixtures
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
                title={
                  snapshot.usingFixtures
                    ? "Canned fixture replies - not calling the real LLM. Unset CRM_E2E_PLATFORM_FIXTURES to hit the live runtime."
                    : "Messages are handled by the live CustomerJourneys platform runtime."
                }
              >
                {snapshot.usingFixtures ? "Fixtures" : "Live platform"}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {runtime?.tenant?.name ?? snapshot.link?.customerjourneys_tenant_id ?? "CustomerJourneys not linked"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Runtime mode: <span className="font-medium text-slate-700">{formatRuntimeMode(runtime?.runtimeMode ?? null)}</span>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <KeyValueCard label="CRM tenant" value={snapshot.link?.crm_tenant_id ?? "Not linked"} />
            <KeyValueCard label="Runtime tenant" value={snapshot.link?.customerjourneys_tenant_id ?? "Not linked"} />
          </div>
        </div>

        {runtimeIssues.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {runtimeIssues.join(" ")}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {channelCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No linked CustomerJourneys runtime was found for this CRM tenant yet.
          </div>
        ) : (
          channelCards.map(([channel, details]) => (
            <div key={channel} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">{formatChannelLabel(channel)}</h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${formatChannelTone(details.ready)}`}>
                  {details.ready ? "Ready" : "Not ready"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {details.displayNumber ?? details.reason ?? "No live transport details available yet."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {details.displayNumber ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(details.displayNumber)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Copy
                  </button>
                ) : null}
                {details.deepLink ? (
                  <a
                    href={details.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </a>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Web Chat</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Live booking conversation</h2>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${formatChannelTone(webchatReady)}`}>
              {webchatReady ? "Live" : "Blocked"}
            </span>
          </div>

          {!webchatSession ? (
            <form className="mt-5 space-y-4" onSubmit={handleCreateWebchatSession}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="live-webchat-name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Customer name
                  </label>
                  <input
                    id="live-webchat-name"
                    value={createForm.fullName}
                    onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label htmlFor="live-webchat-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Email
                  </label>
                  <input
                    id="live-webchat-email"
                    value={createForm.email}
                    onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="live-webchat-opening" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Opening message
                </label>
                <textarea
                  id="live-webchat-opening"
                  value={createForm.openingMessage}
                  onChange={(event) => setCreateForm((current) => ({ ...current, openingMessage: event.target.value }))}
                  className="min-h-[140px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Need a boiler service this Thursday morning."
                />
              </div>

              <button
                type="submit"
                disabled={busy || !webchatReady}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {busy ? "Opening..." : "Start live webchat"}
              </button>
            </form>
          ) : (
            <>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Conversation ID</p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">{webchatSession.conversation.id}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Booking state: {webchatSession.bookingState?.currentState ?? "active"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {webchatSession.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">No runtime messages yet.</p>
                ) : (
                  webchatSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        message.direction === "outbound"
                          ? "bg-blue-50 text-slate-900"
                          : message.direction === "system"
                            ? "bg-slate-100 text-slate-700"
                            : "ml-auto bg-slate-900 text-white"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                        {message.direction === "outbound" ? "Agent" : message.direction === "system" ? "System" : "Customer"}
                      </p>
                      <p className="mt-1 leading-6">{message.body}</p>
                    </div>
                  ))
                )}
              </div>

              <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={handleSendMessage}>
                <label htmlFor="live-webchat-message" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Send message
                </label>
                <textarea
                  id="live-webchat-message"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Customer message to send into the linked webchat runtime..."
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    SMS, WhatsApp, and phone stay on the real live numbers. Web chat is proxied through CustomerJourneys from this CRM page.
                  </p>
                  <button
                    type="submit"
                    disabled={busy || messageBody.trim().length === 0}
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {busy ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Live CRM results</h3>
            <div className="mt-4 space-y-3">
              {snapshot.recentRecords.length === 0 ? (
                <p className="text-sm text-slate-500">No CRM-linked conversations have landed yet.</p>
              ) : (
                snapshot.recentRecords.map((record) => (
                  <div key={record.link.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{formatRecordTitle(record)}</p>
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                        {formatConversationChannel(record.link.latest_channel)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{formatRecordMeta(record) || "Awaiting CRM linkage details."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <DeepLink href="/inbox" label="Inbox" />
                      {record.customer ? <DeepLink href={`/customers/${record.customer.id}`} label="Customer" /> : null}
                      {record.job ? <DeepLink href={`/jobs/${record.job.id}`} label="Job" /> : null}
                      {record.bookingAppointment ? <DeepLink href="/calendar" label="Calendar" /> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Readiness</h3>
            <div className="mt-4 space-y-3 text-sm">
              <KeyValueRow label="Runtime linked" value={snapshot.link?.customerjourneys_tenant_id ? "Yes" : "No"} />
              <KeyValueRow label="Runtime configured" value={snapshot.runtimeConfigured ? "Yes" : "No"} />
              <KeyValueRow label="Booking resources" value={String(runtime?.bookingResourceCount ?? 0)} />
              <KeyValueRow label="Mode" value={formatRuntimeMode(runtime?.runtimeMode ?? null)} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DeepLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </a>
  );
}

function KeyValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-slate-900">{value}</p>
    </div>
  );
}
