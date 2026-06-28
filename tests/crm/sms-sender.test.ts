import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTenantSms } from "@/modules/crm/lib/sms-sender";

const ORIGINAL_ENV = process.env;

function mockTwilioFetch() {
  const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response("", { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("sendTenantSms", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
      TWILIO_AUTH_TOKEN: "secret",
      CRM_TWILIO_MESSAGING_SERVICE_SID: "MG00000000000000000000000000000000",
      DEMO_CONSOLE_ALLOWLIST: "",
    };
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("blocks known fake test numbers before calling Twilio", async () => {
    const fetchMock = mockTwilioFetch();

    const result = await sendTenantSms({
      to: "07700 900111",
      body: "Reminder text",
    });

    expect(result.ok).toBe(false);
    expect(result.warning).toContain("synthetic-number guard");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks historical synthetic live-run prefixes before calling Twilio", async () => {
    const fetchMock = mockTwilioFetch();

    const result = await sendTenantSms({
      to: "+447559120001",
      body: "Reminder text",
    });

    expect(result.ok).toBe(false);
    expect(result.warning).toContain("known_synthetic_prefix:+44755912");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still allows Twilio Magic Numbers for provider-level tests", async () => {
    const fetchMock = mockTwilioFetch();

    const result = await sendTenantSms({
      to: "+15005550006",
      body: "Provider test",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(String(init?.body)).toContain("To=%2B15005550006");
    expect(String(init?.body)).toContain("MessagingServiceSid=MG00000000000000000000000000000000");
  });

  it("can authenticate with a Twilio API key and account SID", async () => {
    process.env.TWILIO_AUTH_TOKEN = "";
    process.env.TWILIO_API_KEY_SID = "SK00000000000000000000000000000000";
    process.env.TWILIO_API_KEY_SECRET = "api-secret";
    const fetchMock = mockTwilioFetch();

    const result = await sendTenantSms({
      to: "+15005550006",
      body: "Provider test",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toEqual(
      expect.objectContaining({
        authorization: `Basic ${Buffer.from("SK00000000000000000000000000000000:api-secret").toString("base64")}`,
      }),
    );
  });
});
