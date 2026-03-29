import { describe, expect, it } from "vitest";
import { jobSchema } from "@/modules/crm/lib/validation";

describe("crm validation", () => {
  it("accepts an empty hidden assigned_engineer_ids field from job forms", () => {
    const parsed = jobSchema.partial().safeParse({
      assigned_engineer_ids: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assigned_engineer_ids).toEqual([]);
    }
  });

  it("accepts checkbox-style assigned_engineer_ids arrays with blank placeholders", () => {
    const parsed = jobSchema.partial().safeParse({
      assigned_engineer_ids: ["", "11111111-1111-4111-8111-111111111111"],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assigned_engineer_ids).toEqual(["11111111-1111-4111-8111-111111111111"]);
    }
  });
});
