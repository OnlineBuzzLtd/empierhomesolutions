"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoWebchatController } from "@/modules/crm/demo-console/use-demo-webchat";

type WebchatTileProps = {
  webchat: DemoWebchatController;
};

export function WebchatTile({ webchat }: WebchatTileProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [webchat.messages.length]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || webchat.busy) return;
    setInput("");
    void webchat.sendMessage(trimmed).catch(() => undefined);
  }

  return (
    // h-full + min-h-0 → fills the grid cell instead of expanding to fit
    // every message. Without these the transcript pushes everything
    // below it off-screen as the conversation grows.
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Chat with us</h3>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          webchat
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-sm">
          {webchat.messages.length === 0 ? (
            <p className="text-xs text-slate-400">
              Try typing something like &quot;My boiler&apos;s broken, can someone come tomorrow?&quot;
            </p>
          ) : (
            webchat.messages.map((m) => (
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
          {webchat.busy ? (
            <p className="max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
              …
            </p>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        {webchat.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{webchat.error}</p>
        ) : null}

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={webchat.busy}
          />
          <button
            type="submit"
            disabled={webchat.busy || input.trim().length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {webchat.busy ? "…" : "Send"}
          </button>
        </form>

        <p className="text-[10px] text-slate-400">
          Scripted demo webchat uses the real AI and tags linked CRM rows for cleanup.
        </p>
      </div>
    </section>
  );
}
