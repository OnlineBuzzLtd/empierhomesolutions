import { createHmac, randomUUID } from "node:crypto";
import { getCrmEnv } from "@/modules/crm/lib/env";

// Server-side helper for the Demo Console trigger endpoints (E-3). The
// replay endpoints (Google / Meta) build a BookingConfirmed envelope
// from a captured fixture, sign it with PLATFORM_SHARED_SECRET, and
// POST it to our own /api/platform/events. That route runs the
// synthetic-number guard (A-1) and the standard processing pipeline,
// so the demo path goes through exactly the same code as a real
// platform-api event would.
//
// Why "round-trip via our own endpoint" rather than calling the
// processor directly? Two reasons:
//   1. The guard is on the HTTP boundary; bypassing it would defeat
//      the safety net we just built.
//   2. The processor's signature/auth/HMAC logic stays in one place.
//      A test that breaks the boundary contract should break this path
//      too, surfaced immediately rather than silently bypassing.

const MAX_SKEW_SECONDS = 5 * 60;

type Channel = "webchat" | "voice" | "sms" | "whatsapp" | "google" | "meta" | "email";

export type PostPlatformEventInput = {
  // Channel string sent through to command-executor.ts where it becomes
  // `source = "ai_${channel}"` (or platform_${channel}) on the lead row.
  channel: Channel;
  // Tenant id — must match the platform-api workspace alias for this
  // tenant. For the demo we use the same id (Supabase-side tenant id).
  workspaceId: string;
  // The fully-built payload to send. Caller is responsible for
  // populating customer fields. The helper enforces `is_test: true`
  // since this code path is the demo-console-only path.
  payload: Record<string, unknown>;
};

export type PostPlatformEventResult = {
  status: number;
  ok: boolean;
  responseBody: string;
  eventId: string;
};

export async function postPlatformEventFromDemo(
  input: PostPlatformEventInput,
): Promise<PostPlatformEventResult> {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    throw new Error("PLATFORM_SHARED_SECRET is not configured; cannot fire demo events.");
  }

  // Build the envelope. event_type=BookingConfirmed because the demo's
  // visible win is "AI conversation → confirmed booking → CRM lights up".
  // The processor materialises lead + customer + job + appointment from
  // this event type. is_test=true is non-negotiable on this path so the
  // cleanup endpoint can find every row created by this firing.
  const eventId = randomUUID();
  const occurredAt = new Date().toISOString();

  const envelope = {
    event_id: eventId,
    event_type: "BookingConfirmed" as const,
    event_version: 1,
    workspace_id: input.workspaceId,
    occurred_at: occurredAt,
    source_system: "agentic_runtime" as const,
    idempotency_key: `demo-console:${eventId}`,
    correlation_id: null,
    causation_id: null,
    aggregate: { type: "booking", id: null },
    payload: {
      ...input.payload,
      channel: input.channel,
      is_test: true,
    },
  };

  const rawBody = JSON.stringify(envelope);
  const timestampSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(timestampSeconds - Math.floor(Date.parse(occurredAt) / 1000)) > MAX_SKEW_SECONDS) {
    // Shouldn't happen — we generated occurredAt just above — but worth
    // catching loudly if process clocks ever drift wildly during a build.
    throw new Error("Generated timestamp outside allowed skew window.");
  }
  const hmac = createHmac("sha256", env.platformSharedSecret);
  hmac.update(`${timestampSeconds}.${rawBody}`);
  const signature = `sha256=${hmac.digest("hex")}`;

  // Use the in-process URL — Next.js routes are reachable at
  // process.env.NEXT_PUBLIC_SITE_URL or VERCEL_URL on prod. For local
  // dev we fall back to localhost:3000.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const response = await fetch(`${baseUrl}/api/platform/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform-timestamp": String(timestampSeconds),
      "x-platform-signature": signature,
      "x-platform-event-id": eventId,
      "x-platform-event-type": envelope.event_type,
    },
    body: rawBody,
  });

  const responseBody = await response.text().catch(() => "");
  return {
    status: response.status,
    ok: response.ok,
    responseBody,
    eventId,
  };
}
