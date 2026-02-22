import { describe, expect, it } from "vitest";
import { loadLpContent } from "@/modules/lp/content/loadContent";

describe("loadLpContent", () => {
  it("loads and validates known LP content", () => {
    const content = loadLpContent({ service: "boiler-repair", location: "uxbridge" });

    expect(content).toBeTruthy();
    expect(content?.service).toBe("boiler-repair");
    expect(content?.locationLabel).toBe("Uxbridge");
  });

  it("returns null for unknown service", () => {
    const content = loadLpContent({ service: "invalid", location: "uxbridge" });
    expect(content).toBeNull();
  });

  it("returns null for unknown location", () => {
    const content = loadLpContent({ service: "boiler-repair", location: "unknown-town" });
    expect(content).toBeNull();
  });

  it("loads power flushing content", () => {
    const content = loadLpContent({ service: "power-flushing", location: "uxbridge" });
    expect(content).toBeTruthy();
    expect(content?.service).toBe("power-flushing");
  });

  it("applies keyword token replacement from query", () => {
    const content = loadLpContent({
      service: "boiler-repair",
      location: "uxbridge",
      keyword: "boiler emergency",
    });

    expect(content?.keyword).toContain("boiler emergency");
  });
});
