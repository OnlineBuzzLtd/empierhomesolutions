import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ abFlags: "" }));
vi.mock("@/lib/env", () => ({
  publicEnv: new Proxy({}, { get: (_t, key) => (key === "abFlags" ? env.abFlags : undefined) }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "empire-home-solutions.vercel.app" }),
}));
vi.mock("@/modules/lp/components/AiChatBubble", () => ({ AiChatBubble: () => null }));
vi.mock("@/modules/lp/components/EducationalChatBubble", () => ({ EducationalChatBubble: () => null }));

describe("website chat while the AI front desk is paused", () => {
  beforeEach(() => {
    env.abFlags = "";
  });

  it("shows no chat unless it is explicitly switched back on", async () => {
    const { WebsiteChat } = await import("@/modules/lp/components/WebsiteChat");
    expect(await WebsiteChat({})).toBeNull();
    env.abFlags = JSON.stringify({ reviews: "on" });
    expect(await WebsiteChat({})).toBeNull();
    env.abFlags = "not json";
    expect(await WebsiteChat({})).toBeNull();
  });

  it("restores the chat when the switch is on", async () => {
    const { WebsiteChat } = await import("@/modules/lp/components/WebsiteChat");
    env.abFlags = JSON.stringify({ webchat: "on" });
    expect(await WebsiteChat({})).not.toBeNull();
  });
});
