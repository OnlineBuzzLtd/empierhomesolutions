import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildDemoPlatformEnvelope,
  computeDemoEventSignature,
} from "@/modules/crm/demo-console/server/post-platform-event";
import { platformEventEnvelopeSchema } from "@/modules/platform/contracts";

// Covers the envelope construction + HMAC signing for the Demo
// Console trigger endpoints (Stream E). These tests pin behaviours
// that real production failures hinged on:
//
//   - workspace_id is forwarded verbatim. The 2026-05-18 trigger
//     failures happened because the endpoint sent tenant_id where
//     workspace_id was expected; this test catches a regression that
//     drops or rewrites the field.
//
//   - is_test = true is non-negotiable on this path. The cleanup
//     endpoint scope-filters by is_test; an envelope without it would
//     create rows the cleanup can't reach.
//
//   - The envelope passes the platformEventEnvelopeSchema, the same
//     zod schema the receiving /api/platform/events route uses to
//     validate inbound bodies. Catches drift between sender and
//     receiver before deploy.
//
//   - HMAC matches the documented contract (sha256 over
//     "${timestamp}.${rawBody}", hex-encoded, prefixed "sha256=").

const eventId = "00000000-0000-4000-8000-000000000123";
const workspaceId = "75d76e43-4e5e-4568-8ff2-e2594c9818f9"; // Empire's real workspace alias
const occurredAt = "2026-05-18T13:00:00.000Z";

describe("buildDemoPlatformEnvelope", () => {
  const basePayload = { customerName: "Jane", customerPhone: "+15005550006" };

  it("forwards workspaceId verbatim", () => {
    const env = buildDemoPlatformEnvelope({
      channel: "google",
      workspaceId,
      payload: basePayload,
      eventId,
      occurredAt,
    });
    expect(env.workspace_id).toBe(workspaceId);
  });

  it("forces payload.is_test = true even when input payload omits it", () => {
    const env = buildDemoPlatformEnvelope({
      channel: "google",
      workspaceId,
      payload: basePayload,
      eventId,
      occurredAt,
    });
    expect(env.payload.is_test).toBe(true);
  });

  it("forces payload.is_test = true even when input payload sets it false", () => {
    const env = buildDemoPlatformEnvelope({
      channel: "google",
      workspaceId,
      payload: { ...basePayload, is_test: false },
      eventId,
      occurredAt,
    });
    expect(env.payload.is_test).toBe(true);
  });

  it("forwards channel into payload.channel", () => {
    const env = buildDemoPlatformEnvelope({
      channel: "meta",
      workspaceId,
      payload: basePayload,
      eventId,
      occurredAt,
    });
    expect(env.payload.channel).toBe("meta");
  });

  it("sets idempotency_key as demo-console:<eventId>", () => {
    const env = buildDemoPlatformEnvelope({
      channel: "google",
      workspaceId,
      payload: basePayload,
      eventId,
      occurredAt,
    });
    expect(env.idempotency_key).toBe(`demo-console:${eventId}`);
  });

  it("produces an envelope that passes platformEventEnvelopeSchema", () => {
    const env = buildDemoPlatformEnvelope({
      channel: "google",
      workspaceId,
      payload: basePayload,
      eventId,
      occurredAt,
    });
    const parsed = platformEventEnvelopeSchema.safeParse(env);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it("does not mutate the caller's payload object", () => {
    const original = { ...basePayload };
    const beforeKeys = Object.keys(original).sort();
    buildDemoPlatformEnvelope({
      channel: "google",
      workspaceId,
      payload: original,
      eventId,
      occurredAt,
    });
    expect(Object.keys(original).sort()).toEqual(beforeKeys);
    expect("channel" in original).toBe(false);
    expect("is_test" in original).toBe(false);
  });
});

describe("computeDemoEventSignature", () => {
  const secret = "test-shared-secret";
  const timestamp = 1779105000;
  const body = '{"hello":"world"}';

  it("returns the canonical sha256=<hex> shape", () => {
    const sig = computeDemoEventSignature(secret, timestamp, body);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("matches the platform's signing contract: sha256(timestamp.body)", () => {
    const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
    expect(computeDemoEventSignature(secret, timestamp, body)).toBe(expected);
  });

  it("changes when the timestamp changes (replay-protection signal)", () => {
    const a = computeDemoEventSignature(secret, timestamp, body);
    const b = computeDemoEventSignature(secret, timestamp + 1, body);
    expect(a).not.toBe(b);
  });

  it("changes when the body changes", () => {
    const a = computeDemoEventSignature(secret, timestamp, body);
    const b = computeDemoEventSignature(secret, timestamp, body + " ");
    expect(a).not.toBe(b);
  });

  it("changes when the secret changes", () => {
    const a = computeDemoEventSignature(secret, timestamp, body);
    const b = computeDemoEventSignature(secret + "x", timestamp, body);
    expect(a).not.toBe(b);
  });
});
