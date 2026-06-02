import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  clearWebchatTriggerResults,
  OperatorPanel,
  type TriggerResult,
} from "@/modules/crm/demo-console/operator/OperatorPanel";
import type { DemoWebchatController } from "@/modules/crm/demo-console/use-demo-webchat";

function webchatController(): DemoWebchatController {
  return {
    messages: [],
    conversationId: null,
    busy: false,
    error: null,
    sendMessage: vi.fn(async () => ({
      conversationId: "aaaaaaaa-1111-4111-8111-111111111111",
      messages: [],
      echoedMessage: null,
      replyMessage: null,
      bookingState: null,
    })),
    reset: vi.fn(),
  };
}

describe("OperatorPanel scripted webchat controls", () => {
  it("clears stale webchat trigger results when a new scripted run starts", () => {
    const results: TriggerResult[] = [
      { channel: "webchat", ok: false, message: "Old blocker", at: new Date("2026-06-01T10:00:00.000Z") },
      { channel: "quote", ok: true, message: "Quote ready", at: new Date("2026-06-01T10:01:00.000Z") },
      { channel: "google", ok: true, message: "Lead fired", at: new Date("2026-06-01T10:02:00.000Z") },
    ];

    expect(clearWebchatTriggerResults(results)).toEqual([
      results[1],
      results[2],
    ]);
  });

  it("renders scenario selection and runner controls for an active demo session", () => {
    const html = renderToStaticMarkup(
      createElement(OperatorPanel, {
        activeSession: {
          sessionId: "demo-session-1",
          startedAt: new Date("2026-06-01T10:00:00.000Z"),
          prospectName: "Shaz",
          prospectPhone: "+447401248976",
        },
        killSwitchAt: null,
        onClose: vi.fn(),
        onSessionStarted: vi.fn(),
        onSessionEnded: vi.fn(),
        onKillSwitchToggled: vi.fn(),
        webchat: webchatController(),
      }),
    );

    expect(html).toContain("Scripted webchat");
    expect(html).toContain("AI customer");
    expect(html).toContain("Fixed script");
    expect(html).toContain("Emergency repair booking");
    expect(html).toContain("Boiler install survey");
    expect(html).toContain("Fixed-price service quote");
    expect(html).toContain("Start");
    expect(html).toContain("Pause");
    expect(html).toContain("Resume");
    expect(html).toContain("Stop");
  });
});
