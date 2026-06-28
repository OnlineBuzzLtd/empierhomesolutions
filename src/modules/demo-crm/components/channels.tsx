"use client";

import { useEffect, useRef } from "react";
import {
  ChevronLeft,
  Video,
  Phone,
  PhoneMissed,
  Mic,
  Plus,
  Send,
  CheckCheck,
  Paperclip,
  Globe,
  Mail,
  Signal,
  Wifi,
  BatteryFull,
  Minus,
  X,
} from "lucide-react";
import type { DemoAgentId, DemoMessage } from "../types";
import { AGENT_SCRIPTS } from "../agent-scripts";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function useAutoScroll(dep: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [dep]);
  return ref;
}

function StatusBar({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "light" ? "text-white" : "text-slate-900";
  return (
    <div className={`flex items-center justify-between px-6 pt-2 pb-1 text-xs font-semibold ${color}`}>
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <Signal size={13} />
        <Wifi size={13} />
        <BatteryFull size={16} />
      </div>
    </div>
  );
}

function TypingDots({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dot = tone === "light" ? "bg-slate-400" : "bg-white/80";
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 animate-bounce rounded-full ${dot}`}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[370px]">
      <div className="overflow-hidden rounded-[2.6rem] border-[12px] border-slate-900 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="relative bg-white">
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
          {children}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-full text-xs font-bold ${className}`}>
      {initials(name)}
    </span>
  );
}

/* ---------------- iMessage / SMS (voice, lead, payments) ---------------- */

function SystemBanner({ message }: { message: DemoMessage }) {
  if (message.channel === "voice") {
    return (
      <div className="my-3 flex items-center justify-center gap-2 text-xs font-medium text-rose-600">
        <PhoneMissed size={14} /> {message.text}
      </div>
    );
  }
  if (message.channel === "web_form") {
    return (
      <div className="my-3 flex items-center justify-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
        <Globe size={14} /> {message.text}
      </div>
    );
  }
  if (message.channel === "email") {
    return (
      <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Mail size={12} /> Email
        </p>
        <p className="mt-1 text-xs text-slate-700">{message.text}</p>
      </div>
    );
  }
  return (
    <div className="my-3 text-center text-[11px] font-medium text-slate-400">{message.text}</div>
  );
}

function SmsThread({
  contactName,
  contactHandle,
  messages,
  typing,
}: {
  contactName: string;
  contactHandle: string;
  messages: DemoMessage[];
  typing: "agent" | "customer" | null;
}) {
  const scrollRef = useAutoScroll(messages.length + (typing ? 1 : 0));
  const lastAgentIdx = messages.map((m) => m.role).lastIndexOf("agent");
  return (
    <PhoneFrame>
      <StatusBar tone="dark" />
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 pb-2 pt-1">
        <ChevronLeft size={20} className="text-blue-500" />
        <Avatar name={contactName} className="h-9 w-9 bg-slate-300 text-slate-700" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{contactName}</p>
          <p className="truncate text-[11px] text-slate-400">{contactHandle}</p>
        </div>
        <Video size={18} className="ml-auto text-blue-500" />
      </div>
      <div ref={scrollRef} className="h-[420px] space-y-1.5 overflow-y-auto bg-white px-3 py-3">
        {messages.map((m, i) => {
          if (m.role === "system") return <SystemBanner key={i} message={m} />;
          const agent = m.role === "agent";
          return (
            <div key={i} className={`flex ${agent ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%]">
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                    agent ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-900"
                  }`}
                >
                  {m.text}
                </div>
                {agent && i === lastAgentIdx ? (
                  <p className="mt-0.5 text-right text-[10px] text-slate-400">Delivered</p>
                ) : null}
              </div>
            </div>
          );
        })}
        {typing ? (
          <div className={`flex ${typing === "agent" ? "justify-end" : "justify-start"}`}>
            <div className={`rounded-2xl px-3 py-2 ${typing === "agent" ? "bg-blue-500" : "bg-slate-200"}`}>
              <TypingDots tone={typing === "agent" ? "dark" : "light"} />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-2">
        <Plus size={20} className="text-slate-400" />
        <div className="flex flex-1 items-center justify-between rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-400">
          Text Message
          <Mic size={16} />
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ---------------- WhatsApp (messaging) ---------------- */

function WhatsAppThread({
  contactName,
  messages,
  typing,
}: {
  contactName: string;
  messages: DemoMessage[];
  typing: "agent" | "customer" | null;
}) {
  const scrollRef = useAutoScroll(messages.length + (typing ? 1 : 0));
  return (
    <PhoneFrame>
      <div className="bg-[#075E54]">
        <StatusBar tone="light" />
        <div className="flex items-center gap-3 px-3 pb-2">
          <ChevronLeft size={20} className="text-white" />
          <Avatar name={contactName} className="h-9 w-9 bg-white/25 text-white" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{contactName}</p>
            <p className="text-[11px] text-emerald-100">online</p>
          </div>
          <div className="ml-auto flex items-center gap-4 text-white">
            <Video size={18} />
            <Phone size={16} />
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="h-[420px] space-y-1.5 overflow-y-auto bg-[#ECE5DD] px-3 py-3">
        {messages.map((m, i) => {
          if (m.role === "system") return <SystemBanner key={i} message={m} />;
          const agent = m.role === "agent";
          return (
            <div key={i} className={`flex ${agent ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-sm leading-snug shadow-sm ${
                  agent ? "bg-[#DCF8C6] text-slate-900" : "bg-white text-slate-900"
                }`}
              >
                {m.text}
                <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px] text-slate-400">
                  09:24 {agent ? <CheckCheck size={12} className="text-sky-500" /> : null}
                </span>
              </div>
            </div>
          );
        })}
        {typing ? (
          <div className={`flex ${typing === "agent" ? "justify-end" : "justify-start"}`}>
            <div className={`rounded-lg px-3 py-2 shadow-sm ${typing === "agent" ? "bg-[#DCF8C6]" : "bg-white"}`}>
              <TypingDots tone="light" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 bg-[#F0F0F0] px-2 py-2">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-400">
          <Paperclip size={16} /> Message
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#075E54] text-white">
          <Mic size={16} />
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ---------------- Website chat widget (web_chat) ---------------- */

function WebChatWidget({
  messages,
  typing,
}: {
  messages: DemoMessage[];
  typing: "agent" | "customer" | null;
}) {
  const scrollRef = useAutoScroll(messages.length + (typing ? 1 : 0));
  return (
    <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
      <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 text-sm font-black text-slate-950">E</span>
        <div>
          <p className="text-sm font-semibold">Empire Heating</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> Typically replies instantly
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-slate-400">
          <Minus size={16} />
          <X size={16} />
        </div>
      </div>
      <div ref={scrollRef} className="h-[400px] space-y-2 overflow-y-auto bg-slate-50 px-3 py-4">
        {messages.map((m, i) => {
          if (m.role === "system") return <SystemBanner key={i} message={m} />;
          // In a website widget, the visitor (customer) sits on the right.
          const visitor = m.role === "customer";
          return (
            <div key={i} className={`flex ${visitor ? "justify-end" : "justify-start"} gap-2`}>
              {!visitor ? (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-black text-slate-950">
                  AI
                </span>
              ) : null}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                  visitor ? "bg-slate-900 text-white" : "bg-white text-slate-800 shadow-sm ring-1 ring-slate-100"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {typing ? (
          <div className={`flex ${typing === "customer" ? "justify-end" : "justify-start"} gap-2`}>
            {typing === "agent" ? (
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-black text-slate-950">AI</span>
            ) : null}
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
              <TypingDots tone="light" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-2.5">
        <div className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-400">
          Type your message…
        </div>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
          <Send size={15} />
        </button>
      </div>
      <p className="bg-slate-50 pb-2 text-center text-[10px] text-slate-400">Powered by Customer Journeys AI</p>
    </div>
  );
}

/* ---------------- Stage selector ---------------- */

export function ChannelStage({
  agent,
  messages,
  running,
}: {
  agent: DemoAgentId;
  messages: DemoMessage[];
  running: boolean;
}) {
  const script = AGENT_SCRIPTS[agent];

  // Work out who is "typing" next while the script plays.
  let typing: "agent" | "customer" | null = null;
  if (running) {
    const last = messages[messages.length - 1];
    typing = !last ? "customer" : last.role === "customer" ? "agent" : "customer";
  }

  if (agent === "messaging") {
    return <WhatsAppThread contactName={script.contactName} messages={messages} typing={typing} />;
  }
  if (agent === "web_chat") {
    return <WebChatWidget messages={messages} typing={typing} />;
  }
  return (
    <SmsThread
      contactName={script.contactName}
      contactHandle={script.contactHandle}
      messages={messages}
      typing={typing}
    />
  );
}
