#!/usr/bin/env node
// One-shot backfill for Phase 2.2 of the enterprise multi-tenant hardening
// plan. Reads `public.bookings` from the customerjourneys-platform-api
// Supabase project and replays them into the Empire CRM as signed
// `booking.confirmed` envelopes via POST /api/platform/events. The receiving
// route upserts idempotently on (tenant_id, source='platform', external_id),
// so re-running this script is safe.
//
// Required environment:
//   PLATFORM_DATABASE_URL       Postgres connection string for the platform-api
//                               Supabase project (service_role or owner user).
//   CRM_PLATFORM_EVENTS_URL     Full URL, e.g. https://crm.customerjourneys.ai/api/platform/events
//   PLATFORM_SHARED_SECRET      Same value as Empire CRM's PLATFORM_SHARED_SECRET.
//   BACKFILL_TENANT_IDS         Comma-separated tenant UUIDs to replay (optional,
//                               defaults to all tenants that appear in bookings).
//   BACKFILL_LIMIT              Cap on number of bookings per tenant (optional).
//   BACKFILL_DRY_RUN=1          Log what would be sent, don't POST.

import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const {
  PLATFORM_DATABASE_URL,
  CRM_PLATFORM_EVENTS_URL,
  PLATFORM_SHARED_SECRET,
  BACKFILL_TENANT_IDS,
  BACKFILL_LIMIT,
  BACKFILL_DRY_RUN,
} = process.env;

function fail(reason) {
  console.error(`[backfill] ${reason}`);
  process.exit(1);
}

if (!PLATFORM_DATABASE_URL) fail("PLATFORM_DATABASE_URL is required.");
if (!CRM_PLATFORM_EVENTS_URL) fail("CRM_PLATFORM_EVENTS_URL is required.");
if (!PLATFORM_SHARED_SECRET) fail("PLATFORM_SHARED_SECRET is required.");

const dryRun = BACKFILL_DRY_RUN === "1" || BACKFILL_DRY_RUN === "true";
const perTenantLimit = BACKFILL_LIMIT ? Number.parseInt(BACKFILL_LIMIT, 10) : null;

function computeSignature(timestampSeconds, rawBody) {
  const hmac = crypto.createHmac("sha256", PLATFORM_SHARED_SECRET);
  hmac.update(`${timestampSeconds}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

function buildCustomerSnapshot(metadata) {
  const identity = metadata?.identity ?? {};
  return {
    name: identity.fullName ?? null,
    email: identity.email ?? null,
    phone: identity.phoneNumber ?? null,
    address_line1: identity.addressLine1 ?? null,
    city: identity.city ?? null,
    postcode: identity.postcode ?? null,
  };
}

function buildEnvelope(booking) {
  const occurredAt = booking.updated_at ?? booking.created_at ?? new Date().toISOString();
  const eventType = booking.status === "cancelled" ? "booking.cancelled" : "booking.confirmed";
  const metadata = booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {};

  return {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    event_version: 1,
    workspace_id: booking.tenant_id,
    occurred_at: new Date(occurredAt).toISOString(),
    source_system: "agentic_runtime",
    idempotency_key: `backfill:booking:${booking.id}:${booking.status}`,
    correlation_id: null,
    causation_id: null,
    aggregate: { type: "booking", id: booking.id },
    payload: {
      booking_id: booking.id,
      tenant_id: booking.tenant_id,
      resource_id: booking.resource_id ?? null,
      start_at: new Date(booking.start_at).toISOString(),
      end_at: new Date(booking.end_at).toISOString(),
      status: booking.status,
      service_key: metadata.service?.serviceKey ?? null,
      service_name: metadata.service?.serviceName ?? null,
      customer: buildCustomerSnapshot(metadata),
      conversation_id: metadata.conversationId ?? null,
      channel: metadata.channel ?? null,
      metadata,
    },
  };
}

async function deliver(envelope) {
  if (dryRun) {
    console.log(
      `[backfill] dry-run booking=${envelope.aggregate.id} tenant=${envelope.workspace_id} status=${envelope.payload.status}`,
    );
    return { ok: true, status: 0 };
  }

  const rawBody = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = computeSignature(timestamp, rawBody);

  const response = await fetch(CRM_PLATFORM_EVENTS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform-shared-secret": PLATFORM_SHARED_SECRET,
      "x-platform-timestamp": timestamp,
      "x-platform-signature": signature,
      "x-platform-event-id": envelope.event_id,
      "x-platform-event-type": envelope.event_type,
    },
    body: rawBody,
  });

  const text = await response.text().catch(() => "");
  return { ok: response.ok, status: response.status, text };
}

async function main() {
  const client = new pg.Client({ connectionString: PLATFORM_DATABASE_URL });
  await client.connect();

  try {
    const tenantFilter = BACKFILL_TENANT_IDS
      ? BACKFILL_TENANT_IDS.split(",").map((value) => value.trim()).filter(Boolean)
      : null;

    const query = `
      SELECT id, tenant_id, resource_id, start_at, end_at, status, metadata, created_at, updated_at
      FROM public.bookings
      WHERE ($1::uuid[] IS NULL OR tenant_id = ANY($1::uuid[]))
        AND status IN ('confirmed', 'hold', 'pending_hold', 'cancelled')
      ORDER BY tenant_id, start_at DESC
      ${perTenantLimit ? "LIMIT $2" : ""}
    `;

    const params = [tenantFilter];
    if (perTenantLimit) params.push(perTenantLimit);

    const { rows } = await client.query(query, params);
    console.log(`[backfill] found ${rows.length} bookings`);

    let okCount = 0;
    let failCount = 0;

    for (const booking of rows) {
      const envelope = buildEnvelope(booking);
      try {
        const result = await deliver(envelope);
        if (result.ok) {
          okCount += 1;
        } else {
          failCount += 1;
          console.error(
            `[backfill] failed booking=${booking.id} status=${result.status} body=${result.text?.slice(0, 200) ?? ""}`,
          );
        }
      } catch (error) {
        failCount += 1;
        console.error(`[backfill] threw booking=${booking.id}:`, error);
      }
    }

    console.log(`[backfill] done ok=${okCount} fail=${failCount} dry_run=${dryRun}`);
    if (failCount > 0) {
      process.exit(2);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[backfill] fatal:", error);
  process.exit(1);
});
