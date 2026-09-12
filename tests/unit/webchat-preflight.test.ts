import { describe, expect, it } from "vitest";
import { webchatPreflightSchema } from "@/modules/lp/webchat-preflight";

describe("webchat preflight contact validation", () => {
  it("normalises all contact fields before session creation", () => {
    expect(webchatPreflightSchema.parse({
      fullName: "  Jane Smith  ",
      phone: "07911 123 456",
      email: " JANE@EXAMPLE.COM ",
      openingMessage: "  Can I book a boiler repair next Tuesday?  ",
    })).toEqual({
      fullName: "Jane Smith",
      phone: "+447911123456",
      email: "jane@example.com",
      openingMessage: "Can I book a boiler repair next Tuesday?",
    });
  });

  it("accepts an already-normalised +44 UK mobile", () => {
    expect(webchatPreflightSchema.parse({
      fullName: "Jane Smith",
      phone: "+447911123456",
      email: "jane@example.com",
      openingMessage: "Boiler repair please",
    }).phone).toBe("+447911123456");
  });

  it("rejects missing details, landlines, and malformed email addresses", () => {
    expect(webchatPreflightSchema.safeParse({
      fullName: "",
      phone: "01895 725151",
      email: "not-an-email",
      openingMessage: "",
    }).success).toBe(false);
  });
});
