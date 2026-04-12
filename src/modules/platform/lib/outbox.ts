import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCrmEnv } from "@/modules/crm/lib/env";
import type { PlatformEventEnvelope, PlatformEventType } from "@/modules/platform/contracts";
import { platformEventEnvelopeSchema } from "@/modules/platform/contracts";
import {
  enqueuePlatformOutboxEvent,
  getWorkspaceAlias,
  listReadyPlatformOutboxEvents,
  markPlatformOutboxEventFailed,
  markPlatformOutboxEventPublished,
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
  const env = getCrmEnv();
  const webhookUrl = dependencies?.webhookUrl ?? env.agenticPlatformEventWebhookUrl;
  const sharedSecret = dependencies?.sharedSecret ?? env.platformSharedSecret;
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const batchSize = dependencies?.batchSize ?? 25;

  if (!webhookUrl || !sharedSecret) {
    return { attempted: 0, published: 0, failed: 0, skipped: true as const };
  }
  let events;
  try {
    events = await listReadyPlatformOutboxEvents(supabase, batchSize);
  } catch {
    return { attempted: 0, published: 0, failed: 0, skipped: true as const };
  }
  let published = 0;
  let failed = 0;

  for (const event of events) {
    const nextAttemptCount = event.delivery_attempt_count + 1;
    try {
      const response = await fetchFn(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-platform-shared-secret": sharedSecret,
        },
        body: JSON.stringify(event.envelope),
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
