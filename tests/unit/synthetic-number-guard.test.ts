import { describe, expect, it } from "vitest";
import {
  collectPhonesFromPayload,
  evaluatePhoneNumber,
  parseAllowlistEnv,
} from "@/modules/platform/lib/synthetic-number-guard";

describe("evaluatePhoneNumber", () => {
  const emptyAllowlist = { allowlist: [] };

  it("accepts null / undefined / empty (no-op)", () => {
    expect(evaluatePhoneNumber(null, emptyAllowlist)).toEqual({ ok: true });
    expect(evaluatePhoneNumber(undefined, emptyAllowlist)).toEqual({ ok: true });
    expect(evaluatePhoneNumber("", emptyAllowlist)).toEqual({ ok: true });
    expect(evaluatePhoneNumber("   ", emptyAllowlist)).toEqual({ ok: true });
  });

  it("accepts Twilio Magic Number family unconditionally", () => {
    expect(evaluatePhoneNumber("+15005550006", emptyAllowlist)).toEqual({ ok: true });
    expect(evaluatePhoneNumber("+15005550001", emptyAllowlist)).toEqual({ ok: true });
  });

  it("blocks the +447463366 prefix used by CAL-003 / May 12-13 incident", () => {
    const result = evaluatePhoneNumber("+447463366301", emptyAllowlist);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.pattern).toMatch(/known_synthetic_prefix:\+447463366/);
    }
  });

  it("blocks every sequential entry in the CAL-003 +447463366XXX range", () => {
    for (let i = 301; i <= 310; i += 1) {
      const number = `+447463366${i}`;
      const result = evaluatePhoneNumber(number, emptyAllowlist);
      expect(result.ok, `expected ${number} to be blocked`).toBe(false);
    }
  });

  it("blocks the historical sender number +447401248976 as a destination", () => {
    const result = evaluatePhoneNumber("+447401248976", emptyAllowlist);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.pattern).toBe("destination_matches_sender");
    }
  });

  it("allows a blocked number when it is on the allowlist", () => {
    const result = evaluatePhoneNumber("+447463366301", { allowlist: ["+447463366301"] });
    expect(result).toEqual({ ok: true });
  });

  it("allows an arbitrary real-looking UK number that is not on a known bad list", () => {
    // Numbers not matching any banned prefix are permitted — the guard is a
    // known-bad list, not a known-good list. The wider safety net is the
    // dedicated Twilio subaccount + the allowlist + Magic Numbers for dev.
    expect(evaluatePhoneNumber("+447700900123", emptyAllowlist)).toEqual({ ok: true });
  });

  it("trims whitespace before matching", () => {
    const result = evaluatePhoneNumber("  +447463366301  ", emptyAllowlist);
    expect(result.ok).toBe(false);
  });

  it("treats a missing allowlist field as empty (defensive for mocked envs)", () => {
    // Some test doubles for getCrmEnv() don't include the new
    // demoConsoleAllowlist field. The guard must not throw on that path.
    expect(evaluatePhoneNumber("+447700900123", {})).toEqual({ ok: true });
    expect(evaluatePhoneNumber("+447700900123", { allowlist: null })).toEqual({
      ok: true,
    });
  });
});

describe("collectPhonesFromPayload", () => {
  it("returns an empty list for null / undefined / scalars", () => {
    expect(collectPhonesFromPayload(null)).toEqual([]);
    expect(collectPhonesFromPayload(undefined)).toEqual([]);
    expect(collectPhonesFromPayload("not an object")).toEqual([]);
    expect(collectPhonesFromPayload(42)).toEqual([]);
  });

  it("finds top-level customerPhone", () => {
    expect(
      collectPhonesFromPayload({ customerPhone: "+447700900123", other: "x" }),
    ).toEqual([{ field: "customerPhone", value: "+447700900123" }]);
  });

  it("finds the various snake/camel/legacy field names that command-executor consumes", () => {
    const found = collectPhonesFromPayload({
      customerPhone: "+447700900001",
      customer_phone: "+447700900002",
      identity_phone: "+447700900003",
      from: "+447700900004",
      phone: "+447700900005",
      phoneNumber: "+447700900006",
      phone_number: "+447700900007",
    });
    expect(found).toHaveLength(7);
    expect(found.map((f) => f.field).sort()).toEqual(
      [
        "customerPhone",
        "customer_phone",
        "from",
        "identity_phone",
        "phone",
        "phoneNumber",
        "phone_number",
      ].sort(),
    );
  });

  it("walks nested objects and reports the full path", () => {
    const found = collectPhonesFromPayload({
      payload: { customer: { phone: "+447700900123" } },
    });
    expect(found).toEqual([{ field: "payload.customer.phone", value: "+447700900123" }]);
  });

  it("walks arrays and reports the indexed path", () => {
    const found = collectPhonesFromPayload({
      contacts: [{ phone: "+447700900111" }, { phone: "+447700900222" }],
    });
    expect(found).toHaveLength(2);
    expect(found[0]).toEqual({ field: "contacts[0].phone", value: "+447700900111" });
    expect(found[1]).toEqual({ field: "contacts[1].phone", value: "+447700900222" });
  });

  it("ignores non-string values under phone-shaped keys", () => {
    expect(collectPhonesFromPayload({ phone: 123 })).toEqual([]);
    expect(collectPhonesFromPayload({ phone: null })).toEqual([]);
  });
});

describe("parseAllowlistEnv", () => {
  it("returns an empty array for empty / null input", () => {
    expect(parseAllowlistEnv(undefined)).toEqual([]);
    expect(parseAllowlistEnv(null)).toEqual([]);
    expect(parseAllowlistEnv("")).toEqual([]);
  });

  it("splits on commas and trims whitespace", () => {
    expect(parseAllowlistEnv("+447700900123, +447700900456 ,+447700900789")).toEqual([
      "+447700900123",
      "+447700900456",
      "+447700900789",
    ]);
  });

  it("filters out empty entries", () => {
    expect(parseAllowlistEnv(",+447700900123,,+447700900456,")).toEqual([
      "+447700900123",
      "+447700900456",
    ]);
  });
});
