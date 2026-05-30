import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  join(process.cwd(), "scripts", "live-empire-channel-tests.mts"),
  "utf8",
);

describe("live channel test safety guard", () => {
  it("requires an explicit recipient allowlist in addition to the live Twilio flag", () => {
    expect(script).toContain("LIVE_TEST_RECIPIENT_ALLOWLIST");
    expect(script).toContain("ALLOW_LIVE_TWILIO=1 is not enough");
  });

  it("checks SMS, WhatsApp, and voice recipients before provider calls", () => {
    expect(script).toContain("assertLivePhoneRecipientAllowed(from");
    expect(script).toContain('assertLivePhoneRecipientAllowed(callerNumber, "Voice caller")');
  });

  it("documents that synthetic real-format numbers are forbidden", () => {
    expect(script).toContain("Synthetic real-format numbers are forbidden by CLAUDE.md");
    expect(script).toContain("Do not send live-provider tests to synthetic real-format numbers");
  });
});
