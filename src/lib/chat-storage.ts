/**
 * Visitor-side localStorage wrappers for the public webchat bubble.
 *
 * Browsers in private mode (Safari) throw on localStorage access; everything
 * is wrapped in try/catch so the chat still works there (state lives in
 * memory only, lost on refresh).
 */

const VISITOR_ID_KEY = "empire_chat_visitor_id";
const CONVERSATION_ID_KEY = "empire_chat_conversation_id";

function safeGet(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // private mode / quota — ignore
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateVisitorId(): string {
  const existing = safeGet(VISITOR_ID_KEY);
  if (existing && existing.length >= 8) return existing;
  const next = `visitor_${generateUuid()}`;
  safeSet(VISITOR_ID_KEY, next);
  return next;
}

export function getConversationId(): string | null {
  return safeGet(CONVERSATION_ID_KEY);
}

export function setConversationId(id: string): void {
  safeSet(CONVERSATION_ID_KEY, id);
}

export function clearConversationId(): void {
  safeRemove(CONVERSATION_ID_KEY);
}
