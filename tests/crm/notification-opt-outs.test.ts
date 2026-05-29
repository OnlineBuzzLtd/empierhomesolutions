import { describe, expect, it } from "vitest";

describe("notification opt-outs", () => {
  it("normalizes contacts per channel", async () => {
    const { normalizeContactForOptOut } = await import("@/modules/crm/notifications/opt-outs");

    expect(normalizeContactForOptOut(" WhatsApp:+44 7700 900111 ", "whatsapp")).toBe("+447700900111");
    expect(normalizeContactForOptOut(" Customer@Example.COM ", "email")).toBe("customer@example.com");
  });

  it("classifies STOP and START style keywords", async () => {
    const { classifyOptOutKeyword } = await import("@/modules/crm/notifications/opt-outs");

    expect(classifyOptOutKeyword(" STOP.")).toBe("stop");
    expect(classifyOptOutKeyword("unsubscribe")).toBe("stop");
    expect(classifyOptOutKeyword(" START ")).toBe("start");
    expect(classifyOptOutKeyword("please stop by tomorrow")).toBeNull();
  });
});
