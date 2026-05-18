import { describe, expect, it } from "vitest";
import { normaliseUkMobileToE164 } from "@/modules/crm/demo-console/normalise-uk-mobile";

// Operators on the demo laptop type natural UK phrasings; downstream
// Twilio + WhatsApp links need strict E.164. The normaliser is what
// keeps them aligned. Tests pin every common input shape an operator
// might type, plus regressions for non-UK passthrough.

describe("normaliseUkMobileToE164", () => {
  it("returns empty when given empty / whitespace", () => {
    expect(normaliseUkMobileToE164("")).toBe("");
    expect(normaliseUkMobileToE164("   ")).toBe("");
  });

  it("preserves a well-formed +44 E.164 number", () => {
    expect(normaliseUkMobileToE164("+447700900123")).toBe("+447700900123");
  });

  it("strips internal whitespace, dashes, parens but keeps the +", () => {
    expect(normaliseUkMobileToE164("+44 7700 900 123")).toBe("+447700900123");
    expect(normaliseUkMobileToE164("+44-7700-900-123")).toBe("+447700900123");
    expect(normaliseUkMobileToE164("+44 (7700) 900-123")).toBe("+447700900123");
  });

  it("normalises 07-prefixed UK domestic mobile to +44", () => {
    expect(normaliseUkMobileToE164("07700900123")).toBe("+447700900123");
    expect(normaliseUkMobileToE164("07700 900123")).toBe("+447700900123");
    expect(normaliseUkMobileToE164("07700 900 123")).toBe("+447700900123");
    expect(normaliseUkMobileToE164("0 7700 900 123")).toBe("+447700900123");
  });

  it("normalises 0044-prefixed international UK", () => {
    expect(normaliseUkMobileToE164("00447700900123")).toBe("+447700900123");
    expect(normaliseUkMobileToE164("0044 7700 900 123")).toBe("+447700900123");
  });

  it("normalises a 10-digit number starting with 7 (no leading 0)", () => {
    expect(normaliseUkMobileToE164("7700900123")).toBe("+447700900123");
  });

  it("preserves Twilio Magic Numbers untouched", () => {
    expect(normaliseUkMobileToE164("+15005550006")).toBe("+15005550006");
    expect(normaliseUkMobileToE164("+1 (500) 555-0006")).toBe("+15005550006");
  });

  it("preserves non-UK E.164 numbers untouched", () => {
    expect(normaliseUkMobileToE164("+33612345678")).toBe("+33612345678");
    expect(normaliseUkMobileToE164("+1 415 555 2671")).toBe("+14155552671");
  });

  it("returns ambiguous inputs unchanged rather than guessing", () => {
    // 8-digit domestic UK landline shape — could be many things, don't guess.
    expect(normaliseUkMobileToE164("01895725151")).toBe("01895725151");
    // 6-digit number — too short to assume anything.
    expect(normaliseUkMobileToE164("123456")).toBe("123456");
    // Letters-only — let the upstream form validation reject.
    expect(normaliseUkMobileToE164("not a number")).toBe("not a number");
  });

  it("trims surrounding whitespace before normalising", () => {
    expect(normaliseUkMobileToE164("  07700 900123  ")).toBe("+447700900123");
    expect(normaliseUkMobileToE164("\t+447700900123\n")).toBe("+447700900123");
  });

  it("regression: 07779305853 (the prospect-demo example from 2026-05-18)", () => {
    // From the demo screenshot where the operator typed a UK domestic
    // number and the WhatsApp link failed silently. Pins the
    // observed-broken case so it can't regress.
    expect(normaliseUkMobileToE164("07779305853")).toBe("+447779305853");
  });
});
