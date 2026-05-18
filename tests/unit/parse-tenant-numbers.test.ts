import { describe, expect, it } from "vitest";
import { parseCustomerJourneysTenantNumbers } from "@/modules/crm/lib/customerjourneys";

// E-1 contract test for the platform-api → Empire CRM tenant-numbers
// response. Pins the response shape that the Demo Console tiles
// depend on. A drift on either side (platform-api renames a field, or
// CRM expects a new one) trips this test rather than landing as
// "voice number not configured" in front of a prospect.

describe("parseCustomerJourneysTenantNumbers", () => {
  it("returns null for null / undefined / non-objects", () => {
    expect(parseCustomerJourneysTenantNumbers(null)).toBeNull();
    expect(parseCustomerJourneysTenantNumbers(undefined)).toBeNull();
    expect(parseCustomerJourneysTenantNumbers("nope")).toBeNull();
    expect(parseCustomerJourneysTenantNumbers(42)).toBeNull();
  });

  it("returns the all-null shape for an empty body", () => {
    expect(parseCustomerJourneysTenantNumbers({})).toEqual({
      voiceNumber: null,
      smsNumber: null,
      whatsappDisplayNumber: null,
      whatsappSenderSid: null,
      voiceConfigured: false,
      smsConfigured: false,
      whatsappConfigured: false,
      lastValidatedAt: null,
    });
  });

  it("extracts the full shape when all fields present", () => {
    const body = {
      voiceNumber: "+441895725151",
      smsNumber: "+441895725151",
      whatsappDisplayNumber: "+441895725152",
      whatsappSenderSid: "XE0123456789abcdef",
      voiceConfigured: true,
      smsConfigured: true,
      whatsappConfigured: true,
      lastValidatedAt: "2026-05-01T00:00:00.000Z",
    };
    expect(parseCustomerJourneysTenantNumbers(body)).toEqual(body);
  });

  it("ignores non-string number fields (defensive against bad upstream JSON)", () => {
    const body = { voiceNumber: 12345, smsNumber: { not: "a string" }, whatsappDisplayNumber: null };
    const parsed = parseCustomerJourneysTenantNumbers(body)!;
    expect(parsed.voiceNumber).toBeNull();
    expect(parsed.smsNumber).toBeNull();
    expect(parsed.whatsappDisplayNumber).toBeNull();
  });

  it("treats configured booleans strictly === true (defensive)", () => {
    const body = { voiceConfigured: "yes", smsConfigured: 1, whatsappConfigured: true };
    const parsed = parseCustomerJourneysTenantNumbers(body)!;
    expect(parsed.voiceConfigured).toBe(false);
    expect(parsed.smsConfigured).toBe(false);
    expect(parsed.whatsappConfigured).toBe(true);
  });

  it("matches the platform-api response contract from internal-crm.ts", () => {
    // This shape is what platform-api's
    // GET /v1/internal/crm/tenants/:tenantId/numbers returns. Mirror
    // it here exactly so a rename in either repo fails this test.
    const platformApiResponseShape = {
      voiceNumber: "+441895725151",
      smsNumber: "+441895725151",
      whatsappDisplayNumber: null,
      whatsappSenderSid: null,
      voiceConfigured: true,
      smsConfigured: true,
      whatsappConfigured: false,
      lastValidatedAt: null,
    };
    expect(parseCustomerJourneysTenantNumbers(platformApiResponseShape)).toEqual(
      platformApiResponseShape,
    );
  });
});
