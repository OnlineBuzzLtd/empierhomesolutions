import { createHmac, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCrmEnv } from "@/modules/crm/lib/env";
import type { PlatformEventEnvelope, PlatformEventType } from "@/modules/platform/contracts";
import { platformEventEnvelopeSchema } from "@/modules/platform/contracts";
import {
  enqueuePlatformOutboxEvent,
  getPlatformOutboxEventById,
  getWorkspaceAlias,
  listReadyPlatformOutboxEvents,
  markPlatformOutboxEventFailed,
  markPlatformOutboxEventPublished,
  type PlatformOutboxEventRecord,
} from "@/modules/platform/lib/repository";

type PublishDependencies = {
  webhookUrl: string;
  sharedSecret: string;
  fetchFn?: typeof fetch;
  batchSize?: number;
};

function buildPlatformEventEnvelope(input: Omit<PlatformEventEnvelope, "event_version"> & { event_version?: number }) {
  return platformEventEnvelopeSchema.parse({
    ...input,
    event_version: input.event_version ?? 1,
  });
}

function buildErrorMessage(response: Response, bodyText: string) {
  return `Platform event publish failed with status ${response.status}${bodyText.length > 0 ? `: ${bodyText}` : ""}`;
}

function buildPlatformSignature(secret: string, timestamp: string, rawBody: string) {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  return `sha256=${hmac.digest("hex")}`;
}

export async function enqueueCrmPlatformEvent(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    eventType: PlatformEventType;
    aggregateType: string;
    aggregateId?: string | null;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    correlationId?: string | null;
    causationId?: string | null;
    occurredAt?: string;
  },
) {
  try {
    const alias = await getWorkspaceAlias(supabase, input.tenantId);
    if (!alias) {
      return null;
    }

    const envelope = buildPlatformEventEnvelope({
      event_id: randomUUID(),
      event_type: input.eventType,
      workspace_id: alias.workspace_id,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      source_system: "crm",
      idempotency_key: input.idempotencyKey,
      correlation_id: input.correlationId ?? null,
      causation_id: input.causationId ?? null,
      aggregate: {
        type: input.aggregateType,
        id: input.aggregateId ?? null,
      },
      payload: input.payload,
    });

    return enqueuePlatformOutboxEvent(supabase, alias, envelope);
  } catch {
    return null;
  }
}

export async function publishPendingPlatformOutboxEvents(
  supabase: SupabaseClient,
  dependencies?: Partial<PublishDependencies>,
) {
  const batchSize = dependencies?.batchSize ?? 25;
  let events;
  try {
    events = await listReadyPlatformOutboxEvents(supabase, batchSize);
  } catch {
    return { attempted: 0, published: 0, failed: 0, skipped: true as const };
  }

  return publishPlatformOutboxEvents(supabase, events, dependencies);
}

export async function publishPlatformOutboxEventById(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    id: string;
    dependencies?: Partial<PublishDependencies>;
  },
) {
  const event = await getPlatformOutboxEventById(supabase, input.tenantId, input.id);
  if (!event) {
    throw new Error("Platform outbox event was not found.");
  }
  if (event.publication_status === "published") {
    return { attempted: 0, published: 0, failed: 0, skipped: false as const, alreadyPublished: true as const };
  }
  if (event.publication_status === "dead_letter") {
    throw new Error("Dead-lettered platform outbox events cannot be replayed.");
  }

  return publishPlatformOutboxEvents(supabase, [event], input.dependencies);
}

async function publishPlatformOutboxEvents(
  supabase: SupabaseClient,
  events: PlatformOutboxEventRecord[],
  dependencies?: Partial<PublishDependencies>,
) {
  const env = getCrmEnv();
  const webhookUrl = dependencies?.webhookUrl ?? env.agenticPlatformEventWebhookUrl;
  const sharedSecret = dependencies?.sharedSecret ?? env.platformSharedSecret;
  const fetchFn = dependencies?.fetchFn ?? fetch;

  if (!webhookUrl || !sharedSecret) {
    return { attempted: 0, published: 0, failed: 0, skipped: true as const };
  }

  let published = 0;
  let failed = 0;

  for (const event of events) {
    const nextAttemptCount = event.delivery_attempt_count + 1;
    try {
      const body = JSON.stringify(event.envelope);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const response = await fetchFn(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-platform-timestamp": timestamp,
          "x-platform-signature": buildPlatformSignature(sharedSecret, timestamp, body),
          "x-platform-shared-secret": sharedSecret,
        },
        body,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(buildErrorMessage(response, bodyText));
      }

      await markPlatformOutboxEventPublished(supabase, {
        id: event.id,
        tenantId: event.tenant_id,
        publishedAt: new Date().toISOString(),
        deliveryAttemptCount: nextAttemptCount,
      });
      published += 1;
    } catch (error) {
      await markPlatformOutboxEventFailed(supabase, {
        id: event.id,
        tenantId: event.tenant_id,
        errorMessage: error instanceof Error ? error.message : "Failed to publish platform event.",
        deliveryAttemptCount: nextAttemptCount,
      });
      failed += 1;
    }
  }

  return {
    attempted: events.length,
    published,
    failed,
    skipped: false as const,
  };
}
