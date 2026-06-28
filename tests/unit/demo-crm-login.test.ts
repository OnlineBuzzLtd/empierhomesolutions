import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_CRM_EMAIL,
  DEMO_SESSION_COOKIE,
  createSessionToken,
  isDemoCrmEnabled,
  verifyCredentials,
  verifySessionToken,
} from "@/modules/demo-crm/auth";

describe("demo-crm auth helpers", () => {
  it("accepts the correct shared credentials (case-insensitive email)", () => {
    expect(verifyCredentials(DEMO_CRM_EMAIL, "trade2026")).toBe(true);
    expect(verifyCredentials("DEMO@EMPIRECRM.TEST", "trade2026")).toBe(true);
  });

  it("rejects a wrong password or email", () => {
    expect(verifyCredentials(DEMO_CRM_EMAIL, "wrong")).toBe(false);
    expect(verifyCredentials("someone@else.test", "trade2026")).toBe(false);
  });

  it("round-trips a signed session token and rejects tampering/expiry", () => {
    const now = 1_000_000_000_000;
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now)).toBe(true);
    // Expired (older than 8h)
    expect(verifySessionToken(token, now + 9 * 60 * 60 * 1000)).toBe(false);
    // Tampered signature
    expect(verifySessionToken(`${now}.deadbeef`, now)).toBe(false);
    // Missing
    expect(verifySessionToken(undefined, now)).toBe(false);
  });

  it("is disabled in production unless explicitly enabled", () => {
    const prev = { node: process.env.NODE_ENV, flag: process.env.ENABLE_DEMO_CRM };
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      delete process.env.ENABLE_DEMO_CRM;
      expect(isDemoCrmEnabled()).toBe(false);
      process.env.ENABLE_DEMO_CRM = "1";
      expect(isDemoCrmEnabled()).toBe(true);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev.node ?? "test";
      if (prev.flag === undefined) delete process.env.ENABLE_DEMO_CRM;
      else process.env.ENABLE_DEMO_CRM = prev.flag;
    }
  });
});

describe("POST /api/try/login", () => {
  beforeEach(() => {
    process.env.ENABLE_DEMO_CRM = "1";
  });

  async function post(body: unknown) {
    const { POST } = await import("@/app/api/try/login/route");
    return POST(
      new Request("http://localhost/api/try/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("sets a session cookie for correct credentials", async () => {
    const res = await post({ email: DEMO_CRM_EMAIL, password: "trade2026" });
    expect(res.status).toBe(200);
    expect(res.cookies.get(DEMO_SESSION_COOKIE)?.value).toBeTruthy();
  });

  it("returns 401 for wrong credentials and sets no cookie", async () => {
    const res = await post({ email: DEMO_CRM_EMAIL, password: "nope" });
    expect(res.status).toBe(401);
    expect(res.cookies.get(DEMO_SESSION_COOKIE)?.value).toBeFalsy();
  });
});
