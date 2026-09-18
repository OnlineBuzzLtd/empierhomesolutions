import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearConversationId,
  getConversationId,
  getOrCreateVisitorId,
  setConversationId,
} from "@/lib/chat-storage";

const key = "empire_chat_conversation_id";
const stored = new Map<string, string>();

describe("public chat conversation expiry", () => {
  beforeEach(() => {
    stored.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (name: string) => stored.get(name) ?? null,
        setItem: (name: string, value: string) => stored.set(name, value),
        removeItem: (name: string) => stored.delete(name),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resumes active conversations and extends expiry after a successful turn", () => {
    setConversationId("conversation-1", "capturing_identity");
    vi.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect(getConversationId()).toBe("conversation-1");
    setConversationId("conversation-1", "checking_availability");
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(getConversationId()).toBe("conversation-1");
  });

  it.each([24, 7 * 24])("discards a conversation last active %i hours ago", (hours) => {
    setConversationId("conversation-1");
    vi.advanceTimersByTime(hours * 60 * 60 * 1000);
    expect(getConversationId()).toBeNull();
    expect(stored.has(key)).toBe(false);
  });

  it.each([
    "handoff",
    "handoff_required",
    "confirmed",
    "confirmed_booking",
    "booking_confirmed",
    "closed",
    "cancelled",
  ])("never resumes the terminal state %s", (state) => {
    setConversationId("conversation-1", state);
    expect(getConversationId()).toBeNull();
    // Defend against terminal snapshots left by older clients too.
    stored.set(key, JSON.stringify({ id: "conversation-1", lastActivityAt: Date.now(), state }));
    expect(getConversationId()).toBeNull();
  });

  it.each(["old-conversation-id", "null", "[]", "{}", '{"id":"c1","lastActivityAt":"invalid"}'])(
    "discards legacy or invalid storage: %s",
    (value) => {
      stored.set(key, value);
      expect(getConversationId()).toBeNull();
    },
  );

  it("discards future timestamps instead of extending sessions indefinitely", () => {
    stored.set(key, JSON.stringify({ id: "conversation-1", lastActivityAt: Date.now() + 1000 }));
    expect(getConversationId()).toBeNull();
  });

  it("preserves visitor identity when ending a conversation", () => {
    const visitor = getOrCreateVisitorId();
    setConversationId("conversation-1");
    clearConversationId();
    expect(getOrCreateVisitorId()).toBe(visitor);
    expect(getConversationId()).toBeNull();
  });

  it("works when browser storage is unavailable", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("Storage blocked");
      },
    });
    expect(() => setConversationId("conversation-1")).not.toThrow();
    expect(getConversationId()).toBeNull();
    expect(getOrCreateVisitorId()).toMatch(/^visitor_/);
  });
});
