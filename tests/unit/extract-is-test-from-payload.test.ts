import { describe, expect, it } from "vitest";
import { extractIsTestFromPayload } from "@/modules/platform/lib/command-executor";

// extractIsTestFromPayload is the single source of truth for "did this
// platform event come from a demo / test run?". It feeds is_test propagation
// into crm.customers / leads / jobs / appointments (Demo Console B-3,
// extending CAL-003). Behaviour must match the documented contract: accept
// either top-level `is_test` or `metadata.is_test`, in any common
// true-ish encoding, default false.

describe("extractIsTestFromPayload", () => {
  it("returns false on empty payload", () => {
    expect(extractIsTestFromPayload({})).toBe(false);
  });

  it("returns true for top-level boolean true", () => {
    expect(extractIsTestFromPayload({ is_test: true })).toBe(true);
  });

  it("returns true for stringy 'true'", () => {
    expect(extractIsTestFromPayload({ is_test: "true" })).toBe(true);
  });

  it("returns true for stringy '1' and numeric 1", () => {
    expect(extractIsTestFromPayload({ is_test: "1" })).toBe(true);
    expect(extractIsTestFromPayload({ is_test: 1 })).toBe(true);
  });

  it("returns true when nested under metadata.is_test", () => {
    expect(extractIsTestFromPayload({ metadata: { is_test: true } })).toBe(true);
    expect(extractIsTestFromPayload({ metadata: { is_test: "1" } })).toBe(true);
  });

  it("prefers top-level over metadata when both are set", () => {
    // Top-level true wins over metadata false (escalates to test).
    expect(extractIsTestFromPayload({ is_test: true, metadata: { is_test: false } })).toBe(true);
    // Top-level false: metadata is the fallback, not the override.
    // (?? semantics: top-level wins if non-null, otherwise metadata.)
    expect(extractIsTestFromPayload({ is_test: false, metadata: { is_test: true } })).toBe(false);
  });

  it("returns false for truthy-but-non-canonical values (defensive)", () => {
    // Anything not in {true, "true", 1, "1"} is treated as false. Prevents
    // accidental escalation from unrelated payload values.
    expect(extractIsTestFromPayload({ is_test: "yes" })).toBe(false);
    expect(extractIsTestFromPayload({ is_test: 2 })).toBe(false);
    expect(extractIsTestFromPayload({ is_test: {} })).toBe(false);
  });

  it("returns false when metadata is not an object", () => {
    expect(extractIsTestFromPayload({ metadata: "not an object" })).toBe(false);
    expect(extractIsTestFromPayload({ metadata: null })).toBe(false);
  });
});
