import { describe, expect, it } from "vitest";
import { parseWebchatSessionResponse } from "@/modules/crm/demo-console/parse-webchat-session";

// Regression-anchored test for the "Session response missing
// conversationId" bug (2026-05-18, Demo Console WebchatTile). The CJ
// runtime returns `{ session: { conversation: { id } } }` but the tile
// was reading `session.conversationId`. This test pins all three
// supported shapes so a future shape drift is surfaced immediately.

describe("parseWebchatSessionResponse", () => {
  it("returns null for non-objects / null / undefined", () => {
    expect(parseWebchatSessionResponse(null)).toBeNull();
    expect(parseWebchatSessionResponse(undefined)).toBeNull();
    expect(parseWebchatSessionResponse("not a session")).toBeNull();
    expect(parseWebchatSessionResponse(42)).toBeNull();
  });

  it("returns null when no conversation id is anywhere", () => {
    expect(parseWebchatSessionResponse({})).toBeNull();
    expect(parseWebchatSessionResponse({ session: {} })).toBeNull();
    expect(parseWebchatSessionResponse({ session: { conversation: {} } })).toBeNull();
  });

  it("reads CJ runtime canonical shape — session.conversation.id", () => {
    const body = {
      ok: true,
      session: {
        conversation: { id: "abc-123" },
        messages: [],
        bookingState: { currentState: "initial" },
      },
    };
    expect(parseWebchatSessionResponse(body)).toEqual({ conversationId: "abc-123" });
  });

  it("reads top-level conversation.id (no session wrapper)", () => {
    const body = { conversation: { id: "abc-456" } };
    expect(parseWebchatSessionResponse(body)).toEqual({ conversationId: "abc-456" });
  });

  it("reads legacy flat camelCase — session.conversationId", () => {
    const body = { session: { conversationId: "abc-789" } };
    expect(parseWebchatSessionResponse(body)).toEqual({ conversationId: "abc-789" });
  });

  it("reads legacy flat snake_case — session.conversation_id", () => {
    const body = { session: { conversation_id: "abc-000" } };
    expect(parseWebchatSessionResponse(body)).toEqual({ conversationId: "abc-000" });
  });

  it("prefers conversation.id when both present (canonical wins)", () => {
    const body = {
      session: {
        conversation: { id: "canonical" },
        conversationId: "legacy",
      },
    };
    expect(parseWebchatSessionResponse(body)).toEqual({ conversationId: "canonical" });
  });

  it("trims whitespace and treats empty-after-trim as missing", () => {
    expect(parseWebchatSessionResponse({ session: { conversationId: "   " } })).toBeNull();
    expect(parseWebchatSessionResponse({ session: { conversationId: "  ok  " } })).toEqual({
      conversationId: "ok",
    });
  });

  it("ignores non-string conversation ids", () => {
    expect(parseWebchatSessionResponse({ session: { conversation: { id: 42 } } })).toBeNull();
    expect(parseWebchatSessionResponse({ session: { conversationId: null } })).toBeNull();
  });
});
