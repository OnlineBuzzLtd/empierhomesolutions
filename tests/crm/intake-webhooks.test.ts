import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

describe("CRM intake webhook helpers", () => {
  it("validates Twilio signatures against the forwarded public URL", async () => {
    const { computeTwilioSignature, verifyTwilioSignature } = await import("@/modules/crm/intake/signatures");
    const params = {
      From: "+447700900111",
      To: "+447700900222",
      Body: "Hello",
    };
    const signature = computeTwilioSignature("https://crm.example.com/api/webhooks/twilio/inbound", params, "auth-token");
    const request = new Request("http://localhost:3000/api/webhooks/twilio/inbound", {
      headers: {
        "x-forwarded-host": "crm.example.com",
        "x-forwarded-proto": "https",
        "x-twilio-signature": signature,
      },
    });

    expect(verifyTwilioSignature({ request, params, authToken: "auth-token" })).toBe(true);
    expect(verifyTwilioSignature({ request, params, authToken: "wrong-token" })).toBe(false);
  });

  it("validates sha256 webhook signatures with or without a provider prefix", async () => {
    const { verifySha256Signature } = await import("@/modules/crm/intake/signatures");
    const rawBody = JSON.stringify({ lead_id: "lead-1" });
    const signature = createHmac("sha256", "secret").update(rawBody).digest("hex");

    expect(verifySha256Signature({ rawBody, secret: "secret", signatureHeader: `sha256=${signature}`, prefix: "sha256=" })).toBe(true);
    expect(verifySha256Signature({ rawBody, secret: "secret", signatureHeader: signature, prefix: "sha256=" })).toBe(true);
    expect(verifySha256Signature({ rawBody, secret: "other", signatureHeader: signature })).toBe(false);
  });

  it("extracts lead ad contact data from provider field arrays and nested changes", async () => {
    const { extractLeadAdContact } = await import("@/modules/crm/intake/lead-ads");

    expect(
      extractLeadAdContact({
        lead: {
          id: "google-lead-1",
          user_column_data: [
            { column_name: "full_name", values: ["Ada Lovelace"] },
            { column_name: "phone_number", values: ["07700 900111"] },
            { column_name: "email", values: ["ada@example.com"] },
            { column_name: "postcode", values: ["UB8 1AA"] },
            { column_name: "issue", values: ["Boiler leaking"] },
          ],
        },
      }),
    ).toMatchObject({
      fullName: "Ada Lovelace",
      phone: "07700 900111",
      email: "ada@example.com",
      postcode: "UB8 1AA",
      message: "Boiler leaking",
      externalLeadId: "google-lead-1",
    });

    expect(
      extractLeadAdContact({
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: "meta-lead-1",
                  full_name: "Grace Hopper",
                  phone_number: "+447700900222",
                  email: "grace@example.com",
                  service: "Blocked drain",
                },
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      fullName: "Grace Hopper",
      phone: "+447700900222",
      email: "grace@example.com",
      message: "Blocked drain",
      externalLeadId: "meta-lead-1",
    });
  });
});
