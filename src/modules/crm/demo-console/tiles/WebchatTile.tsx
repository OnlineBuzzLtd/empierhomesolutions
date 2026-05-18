"use client";

// Webchat tile (D-2, post-fixes). Inline chat that uses the same public
// webchat endpoints the marketing site widget uses:
//   POST /api/public/webchat/sessions  → opens a CJ runtime session
//                                        AND returns the AI's opening
//                                        reply in the same response.
//   POST /api/public/webchat/messages  → sends a turn AND returns the
//                                        AI's reply in the same
//                                        response. No polling needed.
//
// Both responses are parsed by parseWebchatSessionResponse /
// parseWebchatTurnResponse from a sibling module (unit-tested in
// tests/unit/parse-webchat-session.test.ts).
//
// Caveat (unchanged): the public webchat path hardcodes source =
// "empire_lp" and does not accept is_test, so downstream CRM rows
// won't carry is_test=true and won't appear in the LiveDemoPane.
// For clean teardown, use the Google / Meta replay buttons.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseWebchatSessionResponse,
  parseWebchatTurnResponse,
  type ParsedWebchatMessage,
} from "@/modules/crm/demo-console/parse-webchat-session";

type LocalMessage = ParsedWebchatMessage & { local?: boolean };

type WebchatTileProps = {
  prospectName?: string;
  prospectPhone?: string;
};

function makeVisitorId(): string {
  const random = Math.random().toString(36).slice(2, 14);
  return `demo-${random}`;
}

export function WebchatTile({ prospectName }: WebchatTileProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visitorIdRef = useRef<string>(makeVisitorId());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Optimistic local message for the in-flight turn. Replaced by the
  // server's echoed message once the response lands. Lets the prospect
  // see their text appear instantly rather than wait for the round-trip.
  const upsertOptimistic = useCallback((localId: string, body: string) => {
    setMessages((prev) => [
      ...prev,
      { id: localId, body, direction: "inbound", local: true },
    ]);
  }, []);

  const replaceOptimisticWithServerTurn = useCallback(
    (localId: string, echoed: ParsedWebchatMessage | null, reply: ParsedWebchatMessage | null) => {
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== localId);
        const next = [...withoutOptimistic];
        if (echoed) next.push(echoed);
        if (reply) next.push(reply);
        return next;
      });
    },
    [],
  );

  const rollbackOptimistic = useCallback((localId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== localId));
  }, []);

  // First turn: opens a session with `openingMessage` and reads back
  // both the conversation id AND any initial AI reply that arrived in
  // the same response.
  const openSessionWithFirstMessage = useCallback(
    async (firstMessage: string, localId: string): Promise<void> => {
      const res = await fetch("/api/public/webchat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: visitorIdRef.current,
          openingMessage: firstMessage,
          fullName: prospectName,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        const serverMsg =
          body && typeof body === "object" && "error" in body
            ? (body as { error?: { message?: string } }).error?.message ?? null
            : null;
        throw new Error(serverMsg ?? `Session create HTTP ${res.status}`);
      }
      const parsed = parseWebchatSessionResponse(body);
      if (!parsed) throw new Error("Session response missing conversationId.");
      setConversationId(parsed.conversationId);

      // If the server returned an AI reply in the initial response,
      // surface it as a system/outbound message. The server may or may
      // not echo the prospect's opening message — we always have the
      // local optimistic version, so we just replace it with whatever
      // shape the server gave back.
      const echoed = parsed.messages.find((m) => m.direction === "inbound") ?? null;
      const reply = parsed.messages.find((m) => m.direction === "outbound") ?? null;
      replaceOptimisticWithServerTurn(localId, echoed, reply);
    },
    [prospectName, replaceOptimisticWithServerTurn],
  );

  // Subsequent turns: posts to /messages and reads the AI reply from
  // the same response.
  const sendSubsequentTurn = useCallback(
    async (cid: string, body: string, localId: string): Promise<void> => {
      const res = await fetch("/api/public/webchat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: cid, body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== "object" || !("ok" in json) || json.ok !== true) {
        const serverMsg =
          json && typeof json === "object" && "error" in json
            ? (json as { error?: { message?: string } }).error?.message ?? null
            : null;
        throw new Error(serverMsg ?? `Message send HTTP ${res.status}`);
      }
      const turn = parseWebchatTurnResponse(json);
      if (!turn) throw new Error("Message response shape unrecognised.");
      replaceOptimisticWithServerTurn(localId, turn.echoedMessage, turn.replyMessage);
    },
    [replaceOptimisticWithServerTurn],
  );

  const sendMessage = useCallback(
    async (body: string) => {
      const localId = `local-${Date.now()}`;
      setBusy(true);
      setError(null);
      upsertOptimistic(localId, body);
      try {
        if (!conversationId) {
          await openSessionWithFirstMessage(body, localId);
        } else {
          await sendSubsequentTurn(conversationId, body, localId);
        }
      } catch (caught) {
        rollbackOptimistic(localId);
        setError(caught instanceof Error ? caught.message : "Unable to send.");
      } finally {
        setBusy(false);
      }
    },
    [
      conversationId,
      openSessionWithFirstMessage,
      sendSubsequentTurn,
      upsertOptimistic,
      rollbackOptimistic,
    ],
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
          {busy ? (
            <p className="max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
              …
            </p>
          ) : null}
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
