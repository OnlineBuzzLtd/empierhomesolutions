"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { businessDetails } from "@/lib/business";
import {
  clearConversationId,
  clearLegacyConversationId,
  getConversationId,
  getOrCreateVisitorId,
  setConversationId,
} from "@/lib/chat-storage";
import { useChatToggle, useChatToggleRegister } from "@/modules/lp/components/ChatToggleProvider";
import {
  webchatPreflightSchema,
  type WebchatPreflightContact,
  type WebchatPreflightInput,
} from "@/modules/lp/webchat-preflight";

type ChatMessage = {
  id: string;
  body: string;
  direction: "inbound" | "outbound" | "system";
  createdAt: string;
};

type ChatSession = {
  conversationId: string;
  messages: ChatMessage[];
  bookingState: { currentState: string } | null;
};

type GtmEventName =
  | "webchat_opened"
  | "webchat_first_message"
  | "webchat_booking_held"
  | "webchat_booking_confirmed"
  | "webchat_handoff"
  | "webchat_closed";

type PreflightField = keyof WebchatPreflightInput;

const emptyPreflight: WebchatPreflightInput = {
  fullName: "",
  phone: "",
  email: "",
  openingMessage: "",
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeDirection(value: unknown): ChatMessage["direction"] {
  return value === "outbound" || value === "system" ? value : "inbound";
}

function normalizeMessage(value: unknown): ChatMessage | null {
  const record = asRecord(value);
  const id = asString(record.id);
  const body = asString(record.body);
  if (!id || !body) return null;
  return {
    id,
    body,
    direction: normalizeDirection(record.direction),
    createdAt: asString(record.createdAt) ?? asString(record.created_at) ?? new Date().toISOString(),
  };
}

function normalizeSession(value: unknown): ChatSession | null {
  const record = asRecord(value);
  const conversation = asRecord(record.conversation);
  const conversationId = asString(conversation.id) ?? asString(record.conversationId);
  if (!conversationId) return null;

  const rawMessages = Array.isArray(record.messages)
    ? record.messages.map(normalizeMessage).filter((message): message is ChatMessage => message !== null)
    : [];
  const reply = normalizeMessage(record.replyMessage);
  const messages = reply && !rawMessages.some((message) => message.id === reply.id)
    ? [...rawMessages, reply]
    : rawMessages;
  const bookingStateRecord = asRecord(record.bookingState);
  const bookingState = asString(bookingStateRecord.currentState)
    ? { currentState: String(bookingStateRecord.currentState) }
    : null;

  return { conversationId, messages, bookingState };
}

function fireGtmEvent(event: GtmEventName, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const target = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  target.dataLayer = target.dataLayer ?? [];
  target.dataLayer.push({ event, ...payload });
}

export function AiChatBubble({ preflightEnabled = false }: { preflightEnabled?: boolean }) {
  const { isOpen, close: closeViaContext } = useChatToggle();
  const registerHandlers = useChatToggleRegister();
  const [internalOpen, setInternalOpen] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bookingState, setBookingState] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [preflight, setPreflight] = useState<WebchatPreflightInput>({ ...emptyPreflight });
  const [preflightErrors, setPreflightErrors] = useState<Partial<Record<PreflightField, string>>>({});
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const firstMessageFiredRef = useRef(false);
  const lastBookingStateRef = useRef<string | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const sessionRequestRef = useRef(0);
  const legacyAttemptedRef = useRef(false);
  const previousOpenRef = useRef(false);

  const open = isOpen || internalOpen;

  const setOpen = useCallback((next: boolean) => {
    setInternalOpen(next);
    if (!next) closeViaContext();
  }, [closeViaContext]);

  const handleHide = useCallback(() => {
    setOpen(false);
    fireGtmEvent("webchat_closed", {
      conversationId: session?.conversationId ?? null,
      reason: "hidden",
    });
  }, [session?.conversationId, setOpen]);

  useEffect(() => {
    if (preflightEnabled) clearLegacyConversationId();
  }, [preflightEnabled]);

  useEffect(() => registerHandlers({
    open: () => setInternalOpen(true),
    close: () => setInternalOpen(false),
  }), [registerHandlers]);

  useEffect(() => {
    if (open && !previousOpenRef.current) fireGtmEvent("webchat_opened");
    if (!open) legacyAttemptedRef.current = false;
    previousOpenRef.current = open;
  }, [open]);

  const startSession = useCallback(async (contact?: WebchatPreflightContact) => {
    const requestId = sessionRequestRef.current + 1;
    sessionRequestRef.current = requestId;
    setSessionStarting(true);
    setError(null);
    setEnded(false);

    try {
      const existingConversationId = preflightEnabled ? null : getConversationId();
      const response = await fetch("/api/public/webchat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          openingMessage:
            contact?.openingMessage ??
            (existingConversationId ? "(restoring conversation)" : "Hi, I have a question."),
          fullName: contact?.fullName,
          phone: contact?.phone,
          email: contact?.email,
          startNewConversation: preflightEnabled,
          pagePath: window.location.pathname + window.location.search,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok: true; session: unknown }
        | { ok: false; error?: { code: string; message: string } }
        | null;

      if (requestId !== sessionRequestRef.current) return;
      if (!response.ok || !result || !("ok" in result) || !result.ok) {
        const message =
          (result && "error" in result && result.error?.message)
          || (response.status === 429
            ? `We're getting a lot of chat requests — please call ${businessDetails.primaryPhoneDisplay} or try again in a minute.`
            : "Couldn't reach our team. Please try again or call us.");
        setError(message);
        return;
      }

      const normalized = normalizeSession(result.session);
      if (!normalized) {
        setError("The chat returned an unexpected response. Please try again.");
        return;
      }

      activeConversationRef.current = normalized.conversationId;
      if (!preflightEnabled) setConversationId(normalized.conversationId);
      setSession({
        conversationId: normalized.conversationId,
        messages: [],
        bookingState: normalized.bookingState,
      });
      setMessages(normalized.messages);
      setBookingState(normalized.bookingState?.currentState ?? null);
      if (contact) {
        firstMessageFiredRef.current = true;
        fireGtmEvent("webchat_first_message", { conversationId: normalized.conversationId });
        setPreflight({ ...emptyPreflight });
      }
    } catch (requestError) {
      if (requestId !== sessionRequestRef.current) return;
      setError(requestError instanceof Error ? requestError.message : "Couldn't reach our team. Please try again.");
    } finally {
      if (requestId === sessionRequestRef.current) setSessionStarting(false);
    }
  }, [preflightEnabled]);

  useEffect(() => {
    if (!open || preflightEnabled || ended || session || legacyAttemptedRef.current) return;
    legacyAttemptedRef.current = true;
    void startSession();
  }, [ended, open, preflightEnabled, session, startSession]);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!bookingState || bookingState === lastBookingStateRef.current) return;
    lastBookingStateRef.current = bookingState;
    if (bookingState === "hold_created") {
      fireGtmEvent("webchat_booking_held", { conversationId: session?.conversationId });
    } else if (bookingState === "booking_confirmed") {
      fireGtmEvent("webchat_booking_confirmed", { conversationId: session?.conversationId });
    } else if (bookingState === "handoff") {
      fireGtmEvent("webchat_handoff", { conversationId: session?.conversationId });
    }
  }, [bookingState, session?.conversationId]);

  const handlePreflightSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sessionStarting) return;
    const parsed = webchatPreflightSchema.safeParse(preflight);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<PreflightField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as PreflightField | undefined;
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setPreflightErrors(fieldErrors);
      return;
    }

    setPreflightErrors({});
    void startSession(parsed.data);
  }, [preflight, sessionStarting, startSession]);

  const handleSend = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!session || !draft.trim() || busy) return;
    const conversationId = session.conversationId;
    const body = draft.trim();
    const optimistic: ChatMessage = {
      id: `optimistic_${Date.now()}`,
      body,
      direction: "inbound",
      createdAt: new Date().toISOString(),
    };
    setMessages((previous) => [...previous, optimistic]);
    setDraft("");
    setBusy(true);
    setError(null);

    if (!firstMessageFiredRef.current) {
      firstMessageFiredRef.current = true;
      fireGtmEvent("webchat_first_message", { conversationId });
    }

    try {
      const response = await fetch("/api/public/webchat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok: true; session: unknown }
        | { ok: false; error?: { code: string; message: string } }
        | null;

      if (activeConversationRef.current !== conversationId) return;
      if (!response.ok || !result || !("ok" in result) || !result.ok) {
        const message =
          (result && "error" in result && result.error?.message)
          || (response.status === 429
            ? "You're sending messages quickly — please wait a moment."
            : "Message couldn't be delivered. Try again?");
        setError(message);
        setMessages((previous) => previous.filter((item) => item.id !== optimistic.id));
        return;
      }

      const turnRecord = asRecord(result.session);
      const userMessage = normalizeMessage(turnRecord.message);
      const agentReply = normalizeMessage(turnRecord.replyMessage);
      setMessages((previous) => {
        const next = previous.filter((item) => item.id !== optimistic.id);
        if (userMessage) next.push(userMessage);
        if (agentReply) next.push(agentReply);
        return next;
      });
      const nextBookingState = asRecord(turnRecord.bookingState).currentState;
      if (typeof nextBookingState === "string") setBookingState(nextBookingState);
    } catch (sendError) {
      if (activeConversationRef.current !== conversationId) return;
      setError(sendError instanceof Error ? sendError.message : "Message couldn't be delivered.");
      setMessages((previous) => previous.filter((item) => item.id !== optimistic.id));
    } finally {
      if (activeConversationRef.current === conversationId) setBusy(false);
    }
  }, [busy, draft, session]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  const handleEndChat = useCallback(() => {
    if (!session) return;
    const conversationId = session.conversationId;
    if (!preflightEnabled) {
      void fetch("/api/public/webchat/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, closeReason: "customer_ended" }),
      }).catch(() => undefined).finally(() => {
        clearConversationId();
        activeConversationRef.current = null;
        setSession(null);
        setMessages([]);
        setBookingState(null);
        firstMessageFiredRef.current = false;
        lastBookingStateRef.current = null;
        setOpen(false);
        fireGtmEvent("webchat_closed", { conversationId, reason: "customer_ended" });
      });
      return;
    }

    sessionRequestRef.current += 1;
    activeConversationRef.current = null;
    setSession(null);
    setMessages([]);
    setBookingState(null);
    setDraft("");
    setBusy(false);
    setSessionStarting(false);
    setError(null);
    setEnded(true);
    setPreflightErrors({});
    firstMessageFiredRef.current = false;
    lastBookingStateRef.current = null;
    fireGtmEvent("webchat_closed", { conversationId, reason: "customer_ended" });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    void fetch("/api/public/webchat/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, closeReason: "customer_ended" }),
      signal: controller.signal,
    }).catch(() => undefined).finally(() => window.clearTimeout(timeout));
  }, [preflightEnabled, session, setOpen]);

  const handleStartNew = useCallback(() => {
    setEnded(false);
    setError(null);
    setPreflight({ ...emptyPreflight });
    if (!preflightEnabled) {
      legacyAttemptedRef.current = true;
      void startSession();
    }
  }, [preflightEnabled, startSession]);

  const sortedMessages = useMemo(() => messages, [messages]);
  const showPreflight = preflightEnabled && !session && !sessionStarting && !ended;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${businessDetails.name}`}
          className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95 lg:bottom-7 lg:right-7"
          style={{ backgroundColor: "var(--ehs-brand-dark)", boxShadow: "var(--ehs-card-shadow)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
            <path d="M12 3C6.48 3 2 6.94 2 11.5c0 2.05.91 3.92 2.42 5.36L4 21l4.4-1.46c1.13.39 2.34.6 3.6.6 5.52 0 10-3.94 10-8.5S17.52 3 12 3z" />
          </svg>
        </button>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label={`Chat with ${businessDetails.name}`}
          className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900 shadow-2xl md:bottom-7 md:right-7 md:left-auto md:top-auto md:h-[620px] md:w-[390px] md:rounded-2xl md:border md:border-slate-200"
          style={{ boxShadow: "var(--ehs-card-shadow)" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white md:rounded-t-2xl" style={{ backgroundColor: "var(--ehs-brand-dark)" }}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">EH</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{businessDetails.name}</p>
                <p className="truncate text-[11px] text-white/70">AI front desk · usually replies in seconds</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleHide}
              aria-label={preflightEnabled ? "Hide chat" : "Close chat"}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 1 0-1.41 1.42L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
              </svg>
            </button>
          </div>

          {bookingState === "booking_confirmed" ? (
            <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900">
              ✅ You&apos;re booked. We&apos;ll see you soon.
            </div>
          ) : null}

          {ended ? (
            <div className="flex flex-1 flex-col items-center justify-center bg-[var(--ehs-surface)] px-6 text-center" aria-live="polite">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-[var(--ehs-brand-dark)]">Chat ended</h2>
                <p className="mt-2 text-sm text-slate-600">This conversation has been cleared from this browser.</p>
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="mt-5 rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Start a new chat
                </button>
              </div>
            </div>
          ) : showPreflight ? (
            <form onSubmit={handlePreflightSubmit} className="flex-1 overflow-y-auto bg-[var(--ehs-surface)] p-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-[var(--ehs-brand-dark)]">How can we help?</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">Share your contact details so we can help with your enquiry and any booking.</p>
                <div className="mt-4 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="webchat-name">
                    Full name
                    <input
                      id="webchat-name"
                      autoComplete="name"
                      value={preflight.fullName}
                      onChange={(event) => setPreflight((current) => ({ ...current, fullName: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal focus:border-[var(--ehs-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
                      aria-invalid={Boolean(preflightErrors.fullName)}
                    />
                    {preflightErrors.fullName ? <span className="mt-1 block font-normal text-rose-700">{preflightErrors.fullName}</span> : null}
                  </label>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="webchat-phone">
                    Mobile number
                    <input
                      id="webchat-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={preflight.phone}
                      onChange={(event) => setPreflight((current) => ({ ...current, phone: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal focus:border-[var(--ehs-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
                      aria-invalid={Boolean(preflightErrors.phone)}
                    />
                    {preflightErrors.phone ? <span className="mt-1 block font-normal text-rose-700">{preflightErrors.phone}</span> : null}
                  </label>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="webchat-email">
                    Email
                    <input
                      id="webchat-email"
                      type="email"
                      autoComplete="email"
                      value={preflight.email}
                      onChange={(event) => setPreflight((current) => ({ ...current, email: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal focus:border-[var(--ehs-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
                      aria-invalid={Boolean(preflightErrors.email)}
                    />
                    {preflightErrors.email ? <span className="mt-1 block font-normal text-rose-700">{preflightErrors.email}</span> : null}
                  </label>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="webchat-question">
                    How can we help?
                    <textarea
                      id="webchat-question"
                      rows={3}
                      value={preflight.openingMessage}
                      onChange={(event) => setPreflight((current) => ({ ...current, openingMessage: event.target.value }))}
                      className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal focus:border-[var(--ehs-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
                      aria-invalid={Boolean(preflightErrors.openingMessage)}
                    />
                    {preflightErrors.openingMessage ? <span className="mt-1 block font-normal text-rose-700">{preflightErrors.openingMessage}</span> : null}
                  </label>
                </div>
                {error ? <p className="mt-3 text-xs text-rose-700" role="alert">{error}</p> : null}
                <button type="submit" className="mt-4 w-full rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-2.5 text-sm font-semibold text-white">
                  Start chat
                </button>
                <p className="mt-3 text-[10px] leading-4 text-slate-500">Your contact details are sent securely and are not saved in this browser. See our <a href="/privacy" className="underline">privacy notice</a>.</p>
              </div>
            </form>
          ) : (
            <>
              <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-4" style={{ backgroundColor: "var(--ehs-surface)" }}>
                {sessionStarting && messages.length === 0 ? <p className="text-sm text-slate-500">Connecting you to our front desk…</p> : null}
                {sortedMessages.length === 0 && !sessionStarting ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                    <p className="font-semibold">Hi, I&apos;m {businessDetails.name}&apos;s AI front desk.</p>
                    <p className="mt-1 text-slate-600">I can give you a quick quote, book an engineer, or pass you to a human if needed.</p>
                  </div>
                ) : null}
                <ul className="space-y-2">
                  {sortedMessages.map((message) => (
                    <li key={message.id} className={message.direction === "inbound" ? "flex justify-end" : "flex justify-start"}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${message.direction === "inbound" ? "bg-[color:var(--ehs-brand-dark)] text-white" : message.direction === "system" ? "bg-slate-100 italic text-slate-600" : "bg-white text-slate-800"}`}>
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      </div>
                    </li>
                  ))}
                  {busy ? (
                    <li className="flex justify-start">
                      <div className="flex items-center gap-1 rounded-2xl bg-white px-3 py-2 shadow-sm" aria-label="Replying">
                        {["0s", "0.15s", "0.3s"].map((delay) => <span key={delay} className="block h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: delay }} />)}
                      </div>
                    </li>
                  ) : null}
                </ul>
                {error ? <p className="mt-3 text-xs text-rose-700" role="alert">{error}</p> : null}
              </div>

              <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-3 md:rounded-b-2xl">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={session ? "Type your message…" : "Connecting…"}
                    disabled={!session || busy}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--ehs-brand-accent)] disabled:bg-slate-50"
                    style={{ maxHeight: "120px" }}
                  />
                  <button type="submit" disabled={!session || !draft.trim() || busy} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: "var(--ehs-brand-dark)" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                      <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.4.92V9a1 1 0 0 0 .8.98l13.7 2-13.7 2a1 1 0 0 0-.8.98v4.48a1 1 0 0 0 1.4.96z" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Powered by AI · {businessDetails.name}</span>
                  {session ? (
                    <button type="button" onClick={handleEndChat} className="text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">End chat</button>
                  ) : null}
                </div>
              </form>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
