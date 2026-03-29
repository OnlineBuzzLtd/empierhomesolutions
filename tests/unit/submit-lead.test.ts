import { beforeAll, describe, expect, it } from "vitest";

let leadRequestSchema: typeof import("@/modules/forms/api/submitLead").leadRequestSchema;
let sanitizeLeadPayload: typeof import("@/modules/forms/api/submitLead").sanitizeLeadPayload;
let determineCustomerMatch: typeof import("@/modules/forms/api/submitLead").determineCustomerMatch;
let buildSubmissionFingerprint: typeof import("@/modules/forms/api/submitLead").buildSubmissionFingerprint;
let isWithinLeadDedupeWindow: typeof import("@/modules/forms/api/submitLead").isWithinLeadDedupeWindow;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL ??= "https://empirehomesolutions.co.uk";
  process.env.NEXT_PUBLIC_CALL_NUMBER ??= "01895725151";

  const submitLeadModule = await import("@/modules/forms/api/submitLead");
  leadRequestSchema = submitLeadModule.leadRequestSchema;
  sanitizeLeadPayload = submitLeadModule.sanitizeLeadPayload;
  determineCustomerMatch = submitLeadModule.determineCustomerMatch;
  buildSubmissionFingerprint = submitLeadModule.buildSubmissionFingerprint;
  isWithinLeadDedupeWindow = submitLeadModule.isWithinLeadDedupeWindow;
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

describe("website intake matching", () => {
  function buildPayload() {
    return sanitizeLeadPayload({
      name: "Jon Jones",
      email: "jonjones@testing.com",
      house_name_number: "1",
      street: "Fake Street",
      postcode: "IG1 3SW",
      phone: "07779 305853",
      issue: "Boiler not working",
      companyWebsite: "",
      pagePath: "/lp/boiler-installation/uxbridge",
      service: "boilers",
      location: "Uxbridge",
      leadType: "install",
      origin: "https://empirehomesolutions.co.uk",
      attribution: {},
    });
  }

  it("reuses an existing customer only when phone and email or name match", () => {
    const decision = determineCustomerMatch(buildPayload(), [
      {
        id: "customer-1",
        full_name: "Jon Jones",
        email: "jonjones@testing.com",
        phone: "07779305853",
        address_line1: "1 Fake Street",
        postcode: "IG1 3SW",
      },
    ]);

    expect(decision.customerId).toBe("customer-1");
    expect(decision.customerMatchResult).toBe("matched");
    expect(decision.possibleDuplicateCustomerId).toBeNull();
    expect(decision.matchedExistingCustomerHistory).toBe(true);
  });

  it("keeps a possible duplicate flag when a strict match and another phone-only match both exist", () => {
    const decision = determineCustomerMatch(buildPayload(), [
      {
        id: "customer-1",
        full_name: "Jon Jones",
        email: "jonjones@testing.com",
        phone: "07779305853",
        address_line1: "1 Fake Street",
        postcode: "IG1 3SW",
      },
      {
        id: "customer-2",
        full_name: "Shaz Iqbal",
        email: "shaz@onlinebuzz.co.uk",
        phone: "07779305853",
        address_line1: "75 Five Oaks Lane",
        postcode: "IG7 4FP",
      },
    ]);

    expect(decision.customerId).toBe("customer-1");
    expect(decision.customerMatchResult).toBe("matched");
    expect(decision.possibleDuplicateCustomerId).toBe("customer-2");
  });

  it("does not reuse a customer on phone match alone", () => {
    const decision = determineCustomerMatch(buildPayload(), [
      {
        id: "customer-2",
        full_name: "Shaz Iqbal",
        email: "shaz@onlinebuzz.co.uk",
        phone: "07779305853",
        address_line1: "75 Five Oaks Lane",
        postcode: "IG7 4FP",
      },
    ]);

    expect(decision.customerId).toBeNull();
    expect(decision.customerMatchResult).toBe("possible_duplicate");
    expect(decision.possibleDuplicateCustomerId).toBe("customer-2");
    expect(decision.matchedExistingCustomerHistory).toBe(false);
  });
});

describe("website intake dedupe", () => {
  function buildPayload() {
    return sanitizeLeadPayload({
      name: "Jon Jones",
      email: "jonjones@testing.com",
      house_name_number: "1",
      street: "Fake Street",
      postcode: "IG1 3SW",
      phone: "07779 305853",
      issue: "Boiler not working",
      companyWebsite: "",
      pagePath: "/lp/boiler-installation/uxbridge",
      service: "boilers",
      location: "Uxbridge",
      leadType: "install",
      origin: "https://empirehomesolutions.co.uk",
      attribution: {},
    });
  }

  it("builds the same fingerprint for identical submissions", () => {
    const cleanPayload = buildPayload();
    const sameFingerprint = buildSubmissionFingerprint({
      ...cleanPayload,
      phone: "07779 305853",
      issue: "  Boiler   not working ",
    });

    expect(sameFingerprint).toBe(buildSubmissionFingerprint(cleanPayload));
  });

  it("treats identical submissions within 15 minutes as duplicates", () => {
    const now = new Date("2026-03-29T10:15:00.000Z");
    const recentTimestamp = "2026-03-29T10:05:30.000Z";

    expect(isWithinLeadDedupeWindow(now, recentTimestamp)).toBe(true);
  });

  it("creates a new lead outside the dedupe window", () => {
    const now = new Date("2026-03-29T10:30:00.000Z");
    const oldTimestamp = "2026-03-29T10:05:30.000Z";

    expect(isWithinLeadDedupeWindow(now, oldTimestamp)).toBe(false);
  });
});
