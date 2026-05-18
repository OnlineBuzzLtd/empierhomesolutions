"use client";

// Webchat tile (ticket D-2, post-fix). Lightweight inline chat that uses
// the same public webchat endpoints the marketing site widget uses:
//   POST /api/public/webchat/sessions  (creates a CJ runtime session)
//   POST /api/public/webchat/messages  (sends a subsequent message)
//
// **Important caveat**: the public webchat endpoint hardcodes source =
// "empire_lp" and does not accept an is_test flag — the resulting
// customer/lead/job/appointment rows will NOT be tagged is_test=true.
// The session-cleanup endpoint (E-5) only deletes is_test rows, so
// webchat-driven rows survive the cleanup. Document this in the
// runbook and prefer the Google/Meta replay buttons for demos where
// you need clean teardown.
//
// First message uses session.openingMessage; subsequent messages use
// the /messages endpoint with conversationId.

import { useCallback, useEffect, useRef, useState } from "react";
import { parseWebchatSessionResponse } from "@/modules/crm/demo-console/parse-webchat-session";

type ChatMessage = {
  id: string;
  body: string;
  direction: "inbound" | "outbound" | "system";
};

type WebchatTileProps = {
  // Reserved for future per-prospect identity hints (currently the
  // public session schema doesn't accept name/phone, only fullName as
  // optional). Kept on the props so DemoRunStage doesn't have to break
  // its call signature when we add an internal demo session endpoint.
  prospectName?: string;
  prospectPhone?: string;
};

function makeVisitorId(): string {
  // Public session schema requires visitorId min 8 chars. Use a
  // demo-prefixed UUID-like value so server-side logs make it obvious
  // these came from the Demo Console.
  const random = Math.random().toString(36).slice(2, 14);
  return `demo-${random}`;
}

export function WebchatTile({ prospectName }: WebchatTileProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visitorIdRef = useRef<string>(makeVisitorId());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Open a session on first message — the session-create endpoint
  // requires an openingMessage, so the prospect's first typed message
  // doubles as it.
  const openSessionWithMessage = useCallback(
    async (openingMessage: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/public/webchat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId: visitorIdRef.current,
            openingMessage,
            fullName: prospectName,
          }),
        });
        const result = await res.json().catch(() => null);
        if (!res.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
          const serverMsg =
            result && typeof result === "object" && "error" in result
              ? (result as { error?: { message?: string } }).error?.message ?? null
              : null;
          throw new Error(serverMsg ?? `Session create HTTP ${res.status}`);
        }
        const parsed = parseWebchatSessionResponse(result);
        if (!parsed) {
          throw new Error("Session response missing conversationId.");
        }
        setConversationId(parsed.conversationId);
        return parsed.conversationId;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to start chat.");
        return null;
      }
    },
    [prospectName],
  );

  const sendSubsequentMessage = useCallback(
    async (cid: string, body: string): Promise<void> => {
      const res = await fetch("/api/public/webchat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: cid, body }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Message send HTTP ${res.status}: ${detail.slice(0, 120)}`);
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (body: string) => {
      setBusy(true);
      setError(null);
      const localId = `local-${Date.now()}`;
      setMessages((prev) => [...prev, { id: localId, body, direction: "inbound" }]);
      try {
        if (!conversationId) {
          await openSessionWithMessage(body);
        } else {
          await sendSubsequentMessage(conversationId, body);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to send.");
      } finally {
        setBusy(false);
      }
    },
    [conversationId, openSessionWithMessage, sendSubsequentMessage],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput("");
    void sendMessage(trimmed);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Chat with us</h3>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          webchat
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-sm">
          {messages.length === 0 ? (
            <p className="text-xs text-slate-400">
              Try typing something like &quot;My boiler&apos;s broken, can someone come tomorrow?&quot;
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.direction === "inbound"
                    ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-white"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-900"
                }
              >
                {m.body}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        ) : null}

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>

        <p className="text-[10px] text-slate-400">
          Webchat rows are not tagged is_test — they survive the session cleanup. Use the Google /
          Meta triggers in the operator panel for clean teardown.
        </p>
      </div>
    </section>
  );
}
