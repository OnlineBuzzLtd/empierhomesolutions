"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChatToggle, useChatToggleRegister } from "./ChatToggleProvider";
import { clearConversationId, clearLegacyConversationId } from "@/lib/chat-storage";

const storageKey = "empire_education_chat_v1";
const enquiryUrl = "/lp/boiler-repair/uxbridge#lead-form";
type Source = { id: string; title: string; url?: string; version: string };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };
const safeSourceUrl = (url?: string) => {
  if (!url) return null;
  try {
    const value = new URL(url);
    return value.protocol === "https:" &&
      ["empirehomesolutions.co.uk", "empire-home-solutions.vercel.app"].includes(value.hostname)
      ? value.href
      : null;
  } catch {
    return null;
  }
};

export function EducationalChatBubble() {
  const toggle = useChatToggle();
  const register = useChatToggleRegister();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const visible = open || toggle.isOpen;
  useEffect(() => register({ open: () => setOpen(true), close: () => setOpen(false) }), [register]);
  useEffect(() => {
    clearConversationId();
    clearLegacyConversationId();
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved))
        setMessages(
          saved
            .filter(
              (item): item is Message =>
                item &&
                ["user", "assistant"].includes(item.role) &&
                typeof item.content === "string" &&
                item.content.length <= 3000,
            )
            .slice(-12)
            .map((item) => ({
              role: item.role,
              content: item.content,
              sources: Array.isArray(item.sources)
                ? item.sources.filter((s) => s && typeof s.title === "string" && typeof s.id === "string")
                : [],
            })),
        );
    } catch {
      /* Private browsing can disable storage. In-memory chat still works. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-12)));
      } catch {
        /* memory only */
      }
    }
    scrollEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages, ready]);
  useEffect(() => {
    if (visible) input.current?.focus();
  }, [visible]);
  const close = () => {
    setOpen(false);
    toggle.close();
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    setMessages((old) => [...old, { role: "user" as const, content: message }].slice(-12));
    setDraft("");
    setBusy(true);
    try {
      const response = await fetch("/api/public/webchat/education", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history }),
        signal: AbortSignal.timeout(28000),
      });
      const result = await response.json();
      if (result.mode !== "education" || typeof result.answer !== "string" || !Array.isArray(result.sources))
        throw new Error("Unavailable");
      setMessages((old) =>
        [...old, { role: "assistant" as const, content: result.answer, sources: result.sources }].slice(-12),
      );
    } catch {
      setMessages((old) =>
        [
          ...old,
          {
            role: "assistant" as const,
            content:
              "I can’t check our information right now. Please use the enquiry form so the office can help.",
          },
        ].slice(-12),
      );
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  return (
    <div className="fixed bottom-24 right-3 z-50 sm:bottom-5 sm:right-5">
      {visible ? (
        <section
          role="dialog"
          aria-label="Ask about our services"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="flex w-[min(390px,calc(100vw-24px))] max-h-[calc(100dvh-120px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 bg-slate-900 p-4 text-white">
            <div>
              <h2 className="font-semibold">Ask about our services</h2>
              <p className="mt-1 text-xs text-slate-200">
                Information from our services, FAQs and offer terms.
              </p>
            </div>
            <button type="button" onClick={close} aria-label="Close chat" className="p-1 text-xl">
              ×
            </button>
          </header>
          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm"
          >
            <p className="rounded-lg bg-slate-100 p-3">
              Ask about services, published prices or offers. For a booking, quote or callback request, please
              use the enquiry form. This chat does not arrange them.
            </p>
            {messages.map((item, index) => (
              <div
                key={index}
                className={`rounded-lg p-3 ${item.role === "user" ? "ml-6 bg-blue-50" : "mr-2 bg-slate-100"}`}
              >
                <p className="whitespace-pre-wrap">{item.content}</p>
                {Boolean(item.sources?.length) && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {item.sources!.map((source) => (
                      <li key={source.id}>
                        {safeSourceUrl(source.url) ? (
                          <a
                            className="underline"
                            href={safeSourceUrl(source.url)!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {source.title}
                          </a>
                        ) : (
                          <span>{source.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {busy && <p role="status">Checking our information…</p>}
            <div ref={scrollEnd} />
          </div>
          <div className="border-t p-3">
            <a href={enquiryUrl} className="mb-3 block text-sm font-semibold text-blue-800 underline">
              Send an enquiry to the office
            </a>
            <form onSubmit={submit} className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Your question</span>
                <textarea
                  ref={input}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Ask a question"
                  className="w-full resize-none rounded-lg border border-slate-300 p-2 text-base"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="rounded-lg bg-slate-900 px-3 py-3 text-sm text-white disabled:opacity-50"
              >
                Send
              </button>
            </form>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMessages([])}
              className="mt-2 text-xs underline"
            >
              Clear this chat
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Ask about our services
        </button>
      )}
    </div>
  );
}
