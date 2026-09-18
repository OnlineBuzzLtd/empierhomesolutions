// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatBubble } from "@/modules/lp/components/AiChatBubble";
import { ChatToggleProvider } from "@/modules/lp/components/ChatToggleProvider";
import { getConversationId } from "@/lib/chat-storage";

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function openChat() {
  await act(async () => {
    root.render(createElement(ChatToggleProvider, null, createElement(AiChatBubble)));
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label^="Chat with"]')!.click();
  });
}

describe("webchat resume policy in the browser", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    fetchMock.mockReset().mockResolvedValue(
      Response.json({
        ok: true,
        session: {
          conversation: { id: "new-conversation" },
          messages: [],
          bookingState: { currentState: "capturing_intent" },
        },
      }),
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    { ageHours: 7 * 24, state: "capturing_intent", fresh: true },
    { ageHours: 1, state: "handoff_required", fresh: true },
    { ageHours: 1, state: "confirmed_pending_notifications", fresh: true },
    { ageHours: 1, state: "capturing_identity", fresh: false },
  ])(
    "sets startNewConversation=$fresh for $state after $ageHours hours",
    async ({ ageHours, state, fresh }) => {
      localStorage.setItem(
        "empire_chat_conversation_id",
        JSON.stringify({
          id: "old-conversation",
          lastActivityAt: Date.now() - ageHours * 3600000,
          state,
        }),
      );
      await openChat();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ startNewConversation: fresh });
      expect(getConversationId()).toBe("new-conversation");
    },
  );

  it("starts afresh for legacy browser IDs without an activity timestamp", async () => {
    localStorage.setItem("empire_chat_conversation_id", "august-conversation");
    await openChat();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ startNewConversation: true });
  });

  it("does not save a terminal session returned by the runtime", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        ok: true,
        session: {
          conversation: { id: "handoff-conversation" },
          messages: [],
          bookingState: { currentState: "handoff_required" },
        },
      }),
    );
    await openChat();
    expect(getConversationId()).toBeNull();
  });
});
