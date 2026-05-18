import { describe, expect, it } from "vitest";
import { substitutePlaceholders } from "@/modules/crm/demo-console/server/substitute-placeholders";

// Covers the captured-payload replay (Demo Console E-3) placeholder
// substitution. Pure transformation; no I/O. The trigger endpoints
// route real consented prospect data through here before signing the
// platform event — a regression that drops a placeholder would mean
// the demo lead arrives in the CRM with literal "{{prospect_name}}"
// strings instead of the prospect's actual name.

const ctx = { prospect_name: "Jane Smith", prospect_phone: "+447700900123" };

describe("substitutePlaceholders", () => {
  it("returns primitives unchanged", () => {
    expect(substitutePlaceholders(42, ctx)).toBe(42);
    expect(substitutePlaceholders(true, ctx)).toBe(true);
    expect(substitutePlaceholders(null, ctx)).toBeNull();
    expect(substitutePlaceholders(undefined, ctx)).toBeUndefined();
  });

  it("substitutes {{prospect_name}} in strings", () => {
    expect(substitutePlaceholders("Hi {{prospect_name}}!", ctx)).toBe("Hi Jane Smith!");
  });

  it("substitutes {{prospect_phone}} in strings", () => {
    expect(substitutePlaceholders("call {{prospect_phone}} now", ctx)).toBe(
      "call +447700900123 now",
    );
  });

  it("substitutes {{prospect_phone_digits}} (no +, no punctuation)", () => {
    expect(substitutePlaceholders("id-{{prospect_phone_digits}}", ctx)).toBe(
      "id-447700900123",
    );
  });

  it("replaces every occurrence (replaceAll, not just first)", () => {
    expect(
      substitutePlaceholders(
        "{{prospect_name}} and {{prospect_name}} again",
        ctx,
      ),
    ).toBe("Jane Smith and Jane Smith again");
  });

  it("leaves unknown {{tokens}} untouched", () => {
    expect(substitutePlaceholders("{{unknown_token}}", ctx)).toBe("{{unknown_token}}");
  });

  it("recurses into objects", () => {
    const input = {
      payload: {
        customerName: "{{prospect_name}}",
        customerPhone: "{{prospect_phone}}",
        email: "demo+{{prospect_phone_digits}}@test.invalid",
        nested: { greeting: "Hello {{prospect_name}}" },
      },
    };
    expect(substitutePlaceholders(input, ctx)).toEqual({
      payload: {
        customerName: "Jane Smith",
        customerPhone: "+447700900123",
        email: "demo+447700900123@test.invalid",
        nested: { greeting: "Hello Jane Smith" },
      },
    });
  });

  it("recurses into arrays preserving order + index", () => {
    expect(
      substitutePlaceholders(["{{prospect_name}}", 1, "{{prospect_phone}}"], ctx),
    ).toEqual(["Jane Smith", 1, "+447700900123"]);
  });

  it("does not mutate the input object", () => {
    const input = { name: "{{prospect_name}}", nested: { p: "{{prospect_phone}}" } };
    const snapshot = JSON.parse(JSON.stringify(input)) as typeof input;
    substitutePlaceholders(input, ctx);
    expect(input).toEqual(snapshot);
  });

  it("works with the real Google fixture shape (regression anchor)", () => {
    // Shape lifted from src/modules/crm/demo-console/fixtures/google-lead.json
    const fixturePayload = {
      customerName: "{{prospect_name}}",
      customerPhone: "{{prospect_phone}}",
      customerEmail: "demo+{{prospect_phone_digits}}@placeholder.test",
      service_name: "Boiler repair",
    };
    expect(substitutePlaceholders(fixturePayload, ctx)).toEqual({
      customerName: "Jane Smith",
      customerPhone: "+447700900123",
      customerEmail: "demo+447700900123@placeholder.test",
      service_name: "Boiler repair",
    });
  });
});
