import { beforeAll, describe, expect, it } from "vitest";

let leadRequestSchema: typeof import("@/modules/forms/api/submitLead").leadRequestSchema;
let sanitizeLeadPayload: typeof import("@/modules/forms/api/submitLead").sanitizeLeadPayload;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL ??= "https://empirehomesolutions.co.uk";
  process.env.NEXT_PUBLIC_CALL_NUMBER ??= "01895725151";

  const submitLeadModule = await import("@/modules/forms/api/submitLead");
  leadRequestSchema = submitLeadModule.leadRequestSchema;
  sanitizeLeadPayload = submitLeadModule.sanitizeLeadPayload;
});

describe("lead request schema", () => {
  const basePayload = {
    name: "Jane Smith",
    email: "",
    house_name_number: "12",
    street: "High Street",
    postcode: "UB8 1AA",
    phone: "07911123456",
    issue: "No heating and an error code.",
    companyWebsite: "",
    pagePath: "/lp/boiler-repair/uxbridge",
    service: "boiler-repair",
    location: "Uxbridge",
    leadType: "repair" as const,
    origin: "https://empirehomesolutions.co.uk",
    attribution: {},
  };

  it("accepts a valid lead without an email address", () => {
    const parsed = leadRequestSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid lead with an email address", () => {
    const parsed = leadRequestSchema.safeParse({
      ...basePayload,
      email: "Jane.Smith@example.com",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid email address", () => {
    const parsed = leadRequestSchema.safeParse({
      ...basePayload,
      email: "not-an-email",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects missing address fields", () => {
    const parsed = leadRequestSchema.safeParse({
      ...basePayload,
      house_name_number: "",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("sanitizeLeadPayload", () => {
  it("normalizes address and email details for CRM capture", () => {
    const payload = sanitizeLeadPayload({
      name: " Jane Smith ",
      email: " Jane.Smith@Example.com ",
      house_name_number: " 12 ",
      street: " High   Street ",
      postcode: "ub8 1aa",
      phone: "07911 123456",
      issue: " No heating ",
      companyWebsite: "",
      pagePath: "/lp/boiler-repair/uxbridge",
      service: "boiler-repair",
      location: "Uxbridge",
      leadType: "repair",
      origin: "https://empirehomesolutions.co.uk",
      attribution: {},
    });

    expect(payload.email).toBe("jane.smith@example.com");
    expect(payload.address_line1).toBe("12 High Street");
    expect(payload.postcode).toBe("UB8 1AA");
  });
});
