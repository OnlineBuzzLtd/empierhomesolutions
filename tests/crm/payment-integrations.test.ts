import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

describe("payment integration helpers", () => {
  it("validates Stripe webhook signatures", async () => {
    const { verifyStripeWebhookSignature } = await import("@/modules/crm/integrations/payments/payment-links");
    const rawBody = JSON.stringify({ type: "checkout.session.completed" });
    const timestamp = "1800000000";
    const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${rawBody}`).digest("hex");

    expect(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`, "whsec_test")).toBe(true);
    expect(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`, "wrong")).toBe(false);
  });

  it("validates GoCardless webhook signatures", async () => {
    const { verifyGoCardlessWebhookSignature } = await import("@/modules/crm/integrations/payments/payment-links");
    const rawBody = JSON.stringify({ events: [] });
    const signature = createHmac("sha256", "gc-secret").update(rawBody).digest("hex");

    expect(verifyGoCardlessWebhookSignature(rawBody, signature, "gc-secret")).toBe(true);
    expect(verifyGoCardlessWebhookSignature(rawBody, signature, "wrong")).toBe(false);
  });
});
