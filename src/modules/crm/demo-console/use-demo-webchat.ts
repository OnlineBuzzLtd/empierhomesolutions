"use client";

import { useCallback, useRef, useState } from "react";
import {
  parseWebchatSessionResponse,
  parseWebchatTurnResponse,
  type ParsedWebchatMessage,
  type ParsedWebchatSession,
  type ParsedWebchatTurn,
} from "@/modules/crm/demo-console/parse-webchat-session";
import type { DemoWebchatScenarioKey } from "@/modules/crm/demo-console/webchat-scenarios";

export type LocalWebchatMessage = ParsedWebchatMessage & { local?: boolean };

type DemoWebchatApiResponse = {
  ok?: boolean;
  error?: string;
  session?: unknown;
  transcript?: unknown;
};

export type DemoWebchatController = {
  messages: LocalWebchatMessage[];
  conversationId: string | null;
  busy: boolean;
  error: string | null;
  sendMessage: (
    body: string,
    options?: {
      scenarioKey?: DemoWebchatScenarioKey;
      forceNewSession?: boolean;
      conversationId?: string | null;
    },
  ) => Promise<DemoWebchatSendResult>;
  reset: () => void;
};

export type DemoWebchatSendResult = {
  conversationId: string;
  messages: ParsedWebchatMessage[];
  echoedMessage: ParsedWebchatMessage | null;
  replyMessage: ParsedWebchatMessage | null;
  bookingState: string | null;
};

const fallbackScenarioKey: DemoWebchatScenarioKey = "emergency_repair_booking";

export function getDemoWebchatConversationForSend(
  currentConversationId: string | null,
  options: { forceNewSession?: boolean; conversationId?: string | null } = {},
) {
  if (options.forceNewSession) return null;
  return options.conversationId ?? currentConversationId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asParsedSession(value: unknown): ParsedWebchatSession | null {
  if (!isRecord(value)) return null;
  if (typeof value.conversationId !== "string" || !Array.isArray(value.messages)) return null;
  return value as ParsedWebchatSession;
}

function asParsedTurn(value: unknown): ParsedWebchatTurn | null {
  if (!isRecord(value)) return null;
  if (!("echoedMessage" in value) || !("replyMessage" in value)) return null;
  return value as ParsedWebchatTurn;
}

export function useDemoWebchat(): DemoWebchatController {
  const [messages, setMessages] = useState<LocalWebchatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const setActiveConversationId = useCallback((next: string | null) => {
    conversationIdRef.current = next;
    setConversationId(next);
  }, []);

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

  const openSessionWithFirstMessage = useCallback(
    async (
      firstMessage: string,
      localId: string,
      scenarioKey: DemoWebchatScenarioKey,
    ): Promise<DemoWebchatSendResult> => {
      const res = await fetch("/api/crm/demo/webchat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingMessage: firstMessage,
          scenarioKey,
        }),
      });
      const body = (await res.json().catch(() => null)) as DemoWebchatApiResponse | null;
      if (!res.ok || !body || body.ok !== true) {
        throw new Error(body?.error ?? `Session create HTTP ${res.status}`);
      }
      const parsed = asParsedSession(body.transcript) ?? parseWebchatSessionResponse({ ok: true, session: body.session });
      if (!parsed) throw new Error("Session response missing conversationId.");
      setActiveConversationId(parsed.conversationId);
      const echoed = parsed.messages.find((m) => m.direction === "inbound") ?? null;
      const reply = parsed.messages.find((m) => m.direction === "outbound") ?? null;
      replaceOptimisticWithServerTurn(localId, echoed, reply);
      return {
        conversationId: parsed.conversationId,
        messages: parsed.messages,
        echoedMessage: echoed,
        replyMessage: reply,
        bookingState: parsed.bookingState,
      };
    },
    [replaceOptimisticWithServerTurn, setActiveConversationId],
  );

  const sendSubsequentTurn = useCallback(
    async (
      cid: string,
      body: string,
      localId: string,
      scenarioKey: DemoWebchatScenarioKey,
    ): Promise<DemoWebchatSendResult> => {
      const res = await fetch("/api/crm/demo/webchat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: cid, body, scenarioKey }),
      });
      const json = (await res.json().catch(() => null)) as DemoWebchatApiResponse | null;
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.error ?? `Message send HTTP ${res.status}`);
      }
      const turn = asParsedTurn(json.transcript) ?? parseWebchatTurnResponse({ ok: true, session: json.session });
      if (!turn) throw new Error("Message response shape unrecognised.");
      replaceOptimisticWithServerTurn(localId, turn.echoedMessage, turn.replyMessage);
      setActiveConversationId(cid);
      return {
        conversationId: cid,
        messages: [turn.echoedMessage, turn.replyMessage].filter(
          (message): message is ParsedWebchatMessage => message !== null,
        ),
        echoedMessage: turn.echoedMessage,
        replyMessage: turn.replyMessage,
        bookingState: turn.bookingState,
      };
    },
    [replaceOptimisticWithServerTurn, setActiveConversationId],
  );

  const sendMessage = useCallback(
    async (
      body: string,
      options: {
        scenarioKey?: DemoWebchatScenarioKey;
        forceNewSession?: boolean;
        conversationId?: string | null;
      } = {},
    ) => {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const scenarioKey = options.scenarioKey ?? fallbackScenarioKey;
      setBusy(true);
      setError(null);
      upsertOptimistic(localId, body);
      try {
        const activeConversationId = getDemoWebchatConversationForSend(
          conversationIdRef.current,
          options,
        );
        return !activeConversationId || options.forceNewSession
          ? await openSessionWithFirstMessage(body, localId, scenarioKey)
          : await sendSubsequentTurn(activeConversationId, body, localId, scenarioKey);
      } catch (caught) {
        rollbackOptimistic(localId);
        const message = caught instanceof Error ? caught.message : "Unable to send.";
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [
      openSessionWithFirstMessage,
      sendSubsequentTurn,
      upsertOptimistic,
      rollbackOptimistic,
    ],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setBusy(false);
    setError(null);
  }, [setActiveConversationId]);

  return {
    messages,
    conversationId,
    busy,
    error,
    sendMessage,
    reset,
  };
}
