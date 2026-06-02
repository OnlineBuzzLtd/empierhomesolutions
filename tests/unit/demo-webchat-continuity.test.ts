import { describe, expect, it } from "vitest";
import { getDemoWebchatConversationForSend } from "@/modules/crm/demo-console/use-demo-webchat";

describe("demo webchat conversation continuity", () => {
  it("keeps five sequential autopilot sends in one conversation", () => {
    const conversationId = "aaaaaaaa-1111-4111-8111-111111111111";
    let storedConversationId: string | null = null;
    let sessionCreates = 0;
    let followUpSends = 0;

    for (let index = 0; index < 5; index += 1) {
      const activeConversationId = getDemoWebchatConversationForSend(storedConversationId, {
        forceNewSession: index === 0,
      });
      if (!activeConversationId) {
        sessionCreates += 1;
        storedConversationId = conversationId;
      } else {
        followUpSends += 1;
        expect(activeConversationId).toBe(conversationId);
      }
    }

    expect(sessionCreates).toBe(1);
    expect(followUpSends).toBe(4);
    expect(storedConversationId).toBe(conversationId);
  });

  it("allows an explicit conversation id override for operator loops", () => {
    expect(
      getDemoWebchatConversationForSend("old-conversation", {
        conversationId: "returned-conversation",
      }),
    ).toBe("returned-conversation");
  });
});
