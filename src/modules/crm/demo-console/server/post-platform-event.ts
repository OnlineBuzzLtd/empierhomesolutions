import { createHmac, randomUUID } from "node:crypto";
import { getCrmEnv } from "@/modules/crm/lib/env";

// Pure helpers (exported for unit-testability). The trigger endpoints
// shipped without tests of the envelope shape; the workspace_id bug
// (2026-05-18) wasted real production time because of it. These
// helpers stay pure so tests/unit/post-platform-event.test.ts can
// pin both the envelope shape and the HMAC computation without
// touching the network.

export type DemoPlatformEnvelope = {
  event_id: string;
  event_type: "BookingConfirmed";
  event_version: 1;
  workspace_id: string;
  occurred_at: string;
  source_system: "agentic_runtime";
  idempotency_key: string;
  correlation_id: null;
  causation_id: null;
  aggregate: { type: "booking"; id: null };
  payload: Record<string, unknown> & { channel: string; is_test: true };
};

export function buildDemoPlatformEnvelope(input: {
  channel: string;
  workspaceId: string;
  payload: Record<string, unknown>;
  // Both are injected so the helper is deterministic in tests; the
  // real call site uses randomUUID + new Date().toISOString().
  eventId: string;
  occurredAt: string;
}): DemoPlatformEnvelope {
  return {
    event_id: input.eventId,
    event_type: "BookingConfirmed",
    event_version: 1,
    workspace_id: input.workspaceId,
    occurred_at: input.occurredAt,
    source_system: "agentic_runtime",
    idempotency_key: `demo-console:${input.eventId}`,
    correlation_id: null,
    causation_id: null,
    aggregate: { type: "booking", id: null },
    payload: {
      ...input.payload,
      channel: input.channel,
      // is_test is non-negotiable on this code path — the cleanup
      // endpoint scope-filters by it, so any row produced by a demo
      // event must carry the flag through.
      is_test: true,
    },
  };
}

export function computeDemoEventSignature(
  sharedSecret: string,
  timestampSeconds: number,
  rawBody: string,
): string {
  const hmac = createHmac("sha256", sharedSecret);
  hmac.update(`${timestampSeconds}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

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

  const envelope = buildDemoPlatformEnvelope({
    channel: input.channel,
    workspaceId: input.workspaceId,
    payload: input.payload,
    eventId,
    occurredAt,
  });

  const rawBody = JSON.stringify(envelope);
  const timestampSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(timestampSeconds - Math.floor(Date.parse(occurredAt) / 1000)) > MAX_SKEW_SECONDS) {
    // Shouldn't happen — we generated occurredAt just above — but worth
    // catching loudly if process clocks ever drift wildly during a build.
    throw new Error("Generated timestamp outside allowed skew window.");
  }
  const signature = computeDemoEventSignature(env.platformSharedSecret, timestampSeconds, rawBody);

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
