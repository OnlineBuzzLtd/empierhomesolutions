"use client";

// Webchat tile (ticket D-2). Lightweight inline chat widget for the
// prospect to type into during the demo. Creates a session via the
// existing /api/public/webchat/sessions endpoint with source=demo_console
// so any rows it produces are obviously demo-tagged in the CRM.
//
// Why not embed the production AiChatBubble directly? AiChatBubble is
// designed as a floating widget for the marketing site; it expects to be
// a singleton and reads conversation IDs from window-scoped storage.
// Here we want an inline-tile widget that resets cleanly for each demo
// and posts an `is_test=true` hint into platform-api so downstream
// rows are flagged correctly. The shape mirrors AiChatBubble's transport
// without inheriting its global state.

import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  body: string;
  direction: "inbound" | "outbound" | "system";
};

type SessionResponse = {
  conversationId?: string;
  conversation_id?: string;
};

type WebchatTileProps = {
  // E-2 will pass the active consented prospect name + phone so the
  // platform-api conversation opens with identity already populated.
  // Until E-2 lands these are undefined and the prospect types their
  // own name into the chat as they go.
  prospectName?: string;
  prospectPhone?: string;
};

export function WebchatTile({ prospectName, prospectPhone }: WebchatTileProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Open a session lazily on first message — avoids consuming
  // platform-api quota for tiles the prospect never types into.
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    try {
      const res = await fetch("/api/public/webchat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "demo_console",
          customer_full_name: prospectName,
          customer_phone: prospectPhone,
          is_test: true,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Session create failed (${res.status}): ${detail.slice(0, 120)}`);
      }
      const json = (await res.json()) as SessionResponse;
      const id = json.conversationId ?? json.conversation_id ?? null;
      if (!id) throw new Error("Session response missing conversationId.");
      setConversationId(id);
      return id;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start chat.");
      return null;
    }
  }, [conversationId, prospectName, prospectPhone]);

  const sendMessage = useCallback(
    async (body: string) => {
      setBusy(true);
      setError(null);
      try {
        const sid = await ensureSession();
        if (!sid) return;
        const localId = `local-${Date.now()}`;
        setMessages((prev) => [...prev, { id: localId, body, direction: "inbound" }]);
        const res = await fetch(`/api/public/webchat/messages/${sid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, is_test: true }),
        });
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`Message send failed (${res.status}): ${detail.slice(0, 120)}`);
        }
        // The agent reply lands via the underlying platform-api
        // streaming/polling. For the demo we only need the prospect's
        // message to be acknowledged in the UI; the CRM realtime pane
        // (C-4) is the convincing visible evidence that the conversation
        // worked.
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to send.");
      } finally {
        setBusy(false);
      }
    },
    [ensureSession],
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
    <Tile title="Chat with us" channel="webchat">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-sm">
          {messages.length === 0 ? (
            <p className="text-xs text-slate-400">
              Try typing something like "My boiler's broken, can someone come tomorrow?"
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
      </div>
    </Tile>
  );
}

function Tile({
  title,
  channel,
  children,
}: {
  title: string;
  channel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          {channel}
        </span>
      </header>
      {children}
    </section>
  );
}
