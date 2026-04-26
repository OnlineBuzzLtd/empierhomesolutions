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
  getConversationId,
  getOrCreateVisitorId,
  setConversationId,
} from "@/lib/chat-storage";
import { useChatToggle, useChatToggleRegister } from "@/modules/lp/components/ChatToggleProvider";

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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
    ? record.messages.map(normalizeMessage).filter((m): m is ChatMessage => m !== null)
    : [];
  const reply = normalizeMessage(record.replyMessage);
  const messages = reply && !rawMessages.some((m) => m.id === reply.id) ? [...rawMessages, reply] : rawMessages;

  const bookingStateRecord = asRecord(record.bookingState);
  const bookingState = asString(bookingStateRecord.currentState)
    ? { currentState: String(bookingStateRecord.currentState) }
    : null;

  return { conversationId, messages, bookingState };
}

function fireGtmEvent(event: GtmEventName, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...payload });
}

export function AiChatBubble() {
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
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const firstMessageFiredRef = useRef(false);
  const lastBookingStateRef = useRef<string | null>(null);

  const open = isOpen || internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      if (!next) {
        closeViaContext();
      }
    },
    [closeViaContext],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    fireGtmEvent("webchat_closed", {
      conversationId: session?.conversationId ?? null,
    });
  }, [setOpen, session?.conversationId]);

  // Register with the context so other components (StickyCallBar, hero CTAs)
  // can open the chat.
  useEffect(() => {
    return registerHandlers({
      open: () => setInternalOpen(true),
      close: () => setInternalOpen(false),
    });
  }, [registerHandlers]);

  // Open the panel + start a session at most once per "open" event.
  // Earlier this was a useCallback whose deps included session+sessionStarting,
  // which meant every state update created a new function reference, which
  // re-fired this effect and looped on errors. Now the effect runs exactly
  // once when `open` flips true, and is cancellable on unmount/close. Errors
  // surface as toasts; the user retries by closing and reopening.
  const sessionRef = useRef<ChatSession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    if (!open) return;
    if (sessionRef.current) return;

    let cancelled = false;
    fireGtmEvent("webchat_opened");
    setSessionStarting(true);
    setError(null);

    const visitorId = getOrCreateVisitorId();
    const existingConversationId = getConversationId();

    (async () => {
      try {
        const response = await fetch("/api/public/webchat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId,
            openingMessage: existingConversationId
              ? "(restoring conversation)"
              : "Hi, I have a question.",
            pagePath: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
          }),
        });

        if (cancelled) return;

        const result = (await response.json().catch(() => null)) as
          | { ok: true; session: unknown }
          | { ok: false; error?: { code: string; message: string } }
          | null;

        if (cancelled) return;

        if (!response.ok || !result || !("ok" in result) || !result.ok) {
          const errorMessage =
            (result && "error" in result && result.error?.message) ||
            (response.status === 429
              ? `We're getting a lot of chat requests — please call ${businessDetails.primaryPhoneDisplay} or try again in a minute.`
              : "Couldn't reach our team. Please try again or call us.");
          setError(errorMessage);
          return;
        }

        const normalized = normalizeSession(result.session);
        if (!normalized) {
          setError("The chat returned an unexpected response. Please try again.");
          return;
        }

        setSession({
          conversationId: normalized.conversationId,
          messages: [],
          bookingState: normalized.bookingState,
        });
        setMessages(normalized.messages);
        setBookingState(normalized.bookingState?.currentState ?? null);
        setConversationId(normalized.conversationId);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't reach our team. Please try again.");
      } finally {
        if (!cancelled) setSessionStarting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-scroll transcript to the bottom on new messages.
  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, busy]);

  // Surface booking-state changes as GTM events.
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

  const handleSend = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!session || !draft.trim() || busy) return;
      const body = draft.trim();
      const optimistic: ChatMessage = {
        id: `optimistic_${Date.now()}`,
        body,
        direction: "inbound",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft("");
      setBusy(true);
      setError(null);

      if (!firstMessageFiredRef.current) {
        firstMessageFiredRef.current = true;
        fireGtmEvent("webchat_first_message", { conversationId: session.conversationId });
      }

      try {
        const response = await fetch("/api/public/webchat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: session.conversationId, body }),
        });

        const result = (await response.json().catch(() => null)) as
          | { ok: true; session: unknown }
          | { ok: false; error?: { code: string; message: string } }
          | null;

        if (!response.ok || !result || !("ok" in result) || !result.ok) {
          const errorMessage =
            (result && "error" in result && result.error?.message) ||
            (response.status === 429
              ? "You're sending messages quickly — please wait a moment."
              : "Message couldn't be delivered. Try again?");
          setError(errorMessage);
          // Roll back the optimistic message so the UI doesn't show a stuck "sent"
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          return;
        }

        // /messages returns { message, replyMessage } (not a full session
        // like /sessions does). Normalise both and append to the transcript,
        // replacing the optimistic outbound bubble with the persisted one.
        const turnRecord = asRecord(result.session);
        const userMessage = normalizeMessage(turnRecord.message);
        const agentReply = normalizeMessage(turnRecord.replyMessage);
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== optimistic.id);
          const next = [...without];
          if (userMessage) next.push(userMessage);
          if (agentReply) next.push(agentReply);
          return next;
        });
        const bookingStateRecord = asRecord(turnRecord.bookingState);
        if (typeof bookingStateRecord.currentState === "string") {
          setBookingState(bookingStateRecord.currentState);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Message couldn't be delivered.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      } finally {
        setBusy(false);
      }
    },
    [session, draft, busy],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleEndChat = useCallback(async () => {
    if (!session) return;
    try {
      await fetch("/api/public/webchat/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: session.conversationId, closeReason: "customer_ended" }),
      });
    } catch {
      // Best-effort; don't block the UX if the close call fails.
    }
    clearConversationId();
    setSession(null);
    setMessages([]);
    setBookingState(null);
    firstMessageFiredRef.current = false;
    lastBookingStateRef.current = null;
    setOpen(false);
    fireGtmEvent("webchat_closed", { reason: "customer_ended" });
  }, [session, setOpen]);

  const sortedMessages = useMemo(() => messages, [messages]);

  return (
    <>
      {/* Floating bubble */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${businessDetails.name}`}
          className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95 lg:bottom-7 lg:right-7"
          style={{
            backgroundColor: "var(--ehs-brand-dark)",
            boxShadow: "var(--ehs-card-shadow)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M12 3C6.48 3 2 6.94 2 11.5c0 2.05.91 3.92 2.42 5.36L4 21l4.4-1.46c1.13.39 2.34.6 3.6.6 5.52 0 10-3.94 10-8.5S17.52 3 12 3z" />
          </svg>
        </button>
      ) : null}

      {/* Panel */}
      {open ? (
        <div
          role="dialog"
          aria-label={`Chat with ${businessDetails.name}`}
          className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900 shadow-2xl md:bottom-7 md:right-7 md:left-auto md:top-auto md:h-[560px] md:w-[380px] md:rounded-2xl md:border md:border-slate-200"
          style={{ boxShadow: "var(--ehs-card-shadow)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 text-white md:rounded-t-2xl"
            style={{ backgroundColor: "var(--ehs-brand-dark)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
                EH
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{businessDetails.name}</p>
                <p className="truncate text-[11px] text-white/70">
                  AI front desk · usually replies in seconds
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close chat"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 1 0-1.41 1.42L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z" />
              </svg>
            </button>
          </div>

          {/* Booking confirmation banner */}
          {bookingState === "booking_confirmed" ? (
            <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900">
              ✅ You&apos;re booked. We&apos;ll see you soon.
            </div>
          ) : null}

          {/* Transcript */}
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ backgroundColor: "var(--ehs-surface)" }}
          >
            {sessionStarting && messages.length === 0 ? (
              <p className="text-sm text-slate-500">Connecting you to our front desk…</p>
            ) : null}

            {sortedMessages.length === 0 && !sessionStarting ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold">Hi, I&apos;m {businessDetails.name}&apos;s AI front desk.</p>
                <p className="mt-1 text-slate-600">
                  I can give you a quick quote, book an engineer, or pass you to a human if needed.
                </p>
              </div>
            ) : null}

            <ul className="space-y-2">
              {sortedMessages.map((message) => (
                <li
                  key={message.id}
                  className={message.direction === "inbound" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      message.direction === "inbound"
                        ? "bg-[color:var(--ehs-brand-dark)] text-white"
                        : message.direction === "system"
                          ? "bg-slate-100 italic text-slate-600"
                          : "bg-white text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </div>
                </li>
              ))}
              {busy ? (
                <li className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <span className="block h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0s" }} />
                    <span className="block h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.15s" }} />
                    <span className="block h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.3s" }} />
                  </div>
                </li>
              ) : null}
            </ul>

            {error ? (
              <p className="mt-3 text-xs text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="border-t border-slate-200 bg-white p-3 md:rounded-b-2xl"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={session ? "Type your message…" : "Connecting…"}
                disabled={!session || busy}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--ehs-brand-accent)] disabled:bg-slate-50"
                style={{ maxHeight: "120px" }}
              />
              <button
                type="submit"
                disabled={!session || !draft.trim() || busy}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "var(--ehs-brand-dark)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.4.92V9a1 1 0 0 0 .8.98l13.7 2-13.7 2a1 1 0 0 0-.8.98v4.48a1 1 0 0 0 1.4.96z" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>Powered by AI · {businessDetails.name}</span>
              {session ? (
                <button type="button" onClick={handleEndChat} className="text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">
                  End chat
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
