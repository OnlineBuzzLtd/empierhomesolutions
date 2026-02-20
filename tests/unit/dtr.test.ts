import { describe, expect, it } from "vitest";
import { applyTokenReplacement, replaceCopyTokens } from "@/modules/lp/dtr";

describe("dtr", () => {
  it("replaces location, service, and keyword tokens", () => {
    const text = "Fast {{service}} in {{location}} for {{keyword}}";
    const replaced = replaceCopyTokens(text, {
      service: "Boiler Repair",
      location: "Uxbridge",
      keyword: "no heat",
    });

    expect(replaced).toBe("Fast Boiler Repair in Uxbridge for no heat");
  });

  it("replaces nested object tokens recursively", () => {
    const payload = {
      headline: "Need {{service}} in {{location}}?",
      points: ["Fix {{keyword}} today"],
    };

    const replaced = applyTokenReplacement(payload, {
      service: "Boiler Repair",
      location: "Hayes",
      keyword: "error codes",
    });

    expect(replaced.headline).toBe("Need Boiler Repair in Hayes?");
    expect(replaced.points[0]).toBe("Fix error codes today");
  });
});
