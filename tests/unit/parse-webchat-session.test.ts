import { describe, expect, it } from "vitest";
import {
  parseWebchatSessionResponse,
  parseWebchatTurnResponse,
} from "@/modules/crm/demo-console/parse-webchat-session";

// Regression-anchored tests for the two webchat response shapes the
// Demo Console depends on. Each bug below shipped because the shape
// wasn't pinned:
//
//   - 2026-05-18a: WebchatTile read session.conversationId; canonical
//     shape is session.conversation.id → "Session response missing
//     conversationId".
//   - 2026-05-18b: WebchatTile sent messages but never displayed the
//     AI's reply; the reply is in session.replyMessage on /messages
//     responses → prospect sees their message go into the void.

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
    const parsed = parseWebchatSessionResponse(body);
    expect(parsed?.conversationId).toBe("abc-123");
    expect(parsed?.bookingState).toBe("initial");
  });

  it("reads legacy flat camelCase — session.conversationId", () => {
    const body = { session: { conversationId: "abc-789" } };
    expect(parseWebchatSessionResponse(body)?.conversationId).toBe("abc-789");
  });

  it("reads legacy flat snake_case — session.conversation_id", () => {
    const body = { session: { conversation_id: "abc-000" } };
    expect(parseWebchatSessionResponse(body)?.conversationId).toBe("abc-000");
  });

  it("prefers conversation.id when both present", () => {
    const body = {
      session: { conversation: { id: "canonical" }, conversationId: "legacy" },
    };
    expect(parseWebchatSessionResponse(body)?.conversationId).toBe("canonical");
  });

  it("returns an empty messages array when none are present", () => {
    const body = { session: { conversation: { id: "x" } } };
    expect(parseWebchatSessionResponse(body)?.messages).toEqual([]);
  });

  it("extracts messages array verbatim", () => {
    const body = {
      session: {
        conversation: { id: "x" },
        messages: [
          { id: "m1", body: "Hi", direction: "inbound" },
          { id: "m2", body: "Hello — how can I help?", direction: "outbound" },
        ],
      },
    };
    const parsed = parseWebchatSessionResponse(body);
    expect(parsed?.messages).toEqual([
      { id: "m1", body: "Hi", direction: "inbound" },
      { id: "m2", body: "Hello — how can I help?", direction: "outbound" },
    ]);
  });

  it("appends replyMessage when not already in the messages array", () => {
    const body = {
      session: {
        conversation: { id: "x" },
        messages: [{ id: "m1", body: "Hi", direction: "inbound" }],
        replyMessage: { id: "m2", body: "Hi back!", direction: "outbound" },
      },
    };
    expect(parseWebchatSessionResponse(body)?.messages).toEqual([
      { id: "m1", body: "Hi", direction: "inbound" },
      { id: "m2", body: "Hi back!", direction: "outbound" },
    ]);
  });

  it("does NOT duplicate replyMessage when already in messages array", () => {
    const body = {
      session: {
        conversation: { id: "x" },
        messages: [
          { id: "m1", body: "Hi", direction: "inbound" },
          { id: "m2", body: "Hi back!", direction: "outbound" },
        ],
        replyMessage: { id: "m2", body: "Hi back!", direction: "outbound" },
      },
    };
    expect(parseWebchatSessionResponse(body)?.messages).toHaveLength(2);
  });

  it("skips malformed message entries instead of throwing", () => {
    const body = {
      session: {
        conversation: { id: "x" },
        messages: [
          { id: "m1", body: "good" },
          { id: "m2" }, // missing body
          { body: "no id" },
          null,
          "string",
        ],
      },
    };
    const parsed = parseWebchatSessionResponse(body);
    expect(parsed?.messages).toEqual([{ id: "m1", body: "good", direction: "system" }]);
  });
});

describe("parseWebchatTurnResponse", () => {
  it("returns null for non-objects", () => {
    expect(parseWebchatTurnResponse(null)).toBeNull();
    expect(parseWebchatTurnResponse(42)).toBeNull();
  });

  it("returns nulls when session has no message + no replyMessage", () => {
    const parsed = parseWebchatTurnResponse({ session: {} });
    expect(parsed).toEqual({ echoedMessage: null, replyMessage: null, bookingState: null });
  });

  it("extracts echoedMessage from session.message", () => {
    const body = {
      session: { message: { id: "m1", body: "Hi", direction: "inbound" } },
    };
    const parsed = parseWebchatTurnResponse(body);
    expect(parsed?.echoedMessage).toEqual({ id: "m1", body: "Hi", direction: "inbound" });
  });

  it("extracts replyMessage — the load-bearing AI reply field", () => {
    const body = {
      session: {
        message: { id: "m1", body: "Hi", direction: "inbound" },
        replyMessage: { id: "m2", body: "How can I help?", direction: "outbound" },
      },
    };
    const parsed = parseWebchatTurnResponse(body);
    expect(parsed?.replyMessage).toEqual({
      id: "m2",
      body: "How can I help?",
      direction: "outbound",
    });
  });

  it("extracts bookingState.currentState when present", () => {
    const body = {
      session: {
        replyMessage: { id: "m2", body: "Booked.", direction: "outbound" },
        bookingState: { currentState: "booking_confirmed" },
      },
    };
    expect(parseWebchatTurnResponse(body)?.bookingState).toBe("booking_confirmed");
  });

  it("handles top-level shape (no session wrapper)", () => {
    const body = {
      message: { id: "m1", body: "Hi", direction: "inbound" },
      replyMessage: { id: "m2", body: "Hello.", direction: "outbound" },
    };
    const parsed = parseWebchatTurnResponse(body);
    expect(parsed?.echoedMessage?.id).toBe("m1");
    expect(parsed?.replyMessage?.id).toBe("m2");
  });
});
