import { z } from "zod";
import type { AiConversationChannel, AiMessageRole } from "@/modules/crm/types";
import { getCrmEnv } from "@/modules/crm/lib/env";

export const liveTesterStatuses = ["open", "qualified", "booked", "escalated"] as const;
export type LiveTesterStatus = (typeof liveTesterStatuses)[number];

const liveTesterStatusSchema = z.enum(liveTesterStatuses);
const liveAgentMessageRoleSchema = z.enum(["customer", "assistant", "system"] satisfies AiMessageRole[]);
const liveAgentChannelSchema = z.enum(["sms", "whatsapp", "web_chat", "voice"] satisfies AiConversationChannel[]);

export const liveAgentMessageSchema = z.object({
  role: liveAgentMessageRoleSchema,
  body: z.string().min(1),
  sender_label: z.string().min(1).optional(),
  channel: liveAgentChannelSchema.optional(),
});

export const liveAgentActionSchema = z.object({
  agent_type: z.enum(["triage", "qualification", "booking", "faq", "escalation"]).default("triage"),
  title: z.string().min(1),
  detail: z.string().min(1),
  status_label: z.string().min(1).default("completed"),
});

export const liveAgentInputSchema = z.object({
  tenant_id: z.uuid(),
  workspace_id: z.uuid(),
  conversation_id: z.uuid(),
  channel: z.enum(["sms", "whatsapp", "web_chat"]),
  customer: z.object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
  }),
  messages: z.array(liveAgentMessageSchema),
});

export const liveAgentResultSchema = z.object({
  assistant_messages: z.array(
    z.object({
      body: z.string().min(1),
      sender_label: z.string().min(1).optional(),
      channel: liveAgentChannelSchema.optional(),
    }),
  ),
  status: liveTesterStatusSchema,
  qualification: z
    .object({
      summary: z.string().min(1),
      service: z.string().trim().min(1).optional(),
      urgency: z.string().trim().min(1).optional(),
    })
    .optional(),
  booking: z
    .object({
      start_at: z.string().datetime({ offset: true }),
      end_at: z.string().datetime({ offset: true }),
      slot_label: z.string().trim().min(1).optional(),
      booking_uid: z.string().trim().min(1).optional(),
    })
    .optional(),
  crm_hints: z
    .object({
      identity_phone: z.string().trim().min(1).optional(),
      identity_email: z.string().email().optional(),
      customer_name: z.string().trim().min(1).optional(),
      job_id: z.uuid().optional(),
    })
    .optional(),
  actions: z.array(liveAgentActionSchema).default([]),
});

export type LiveAgentInput = z.infer<typeof liveAgentInputSchema>;
export type LiveAgentResult = z.infer<typeof liveAgentResultSchema>;

export interface LiveAgentAdapter {
  send(input: LiveAgentInput): Promise<LiveAgentResult>;
}

export class LiveAgentNotConfiguredError extends Error {
  constructor() {
    super("Live agent runtime is not configured.");
  }
}

export class LiveAgentAuthError extends Error {
  constructor() {
    super("Live agent runtime authentication failed.");
  }
}

export class LiveAgentRequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}

class HttpLiveAgentAdapter implements LiveAgentAdapter {
  constructor(
    private readonly config: {
      url: string;
      token: string;
      timeoutMs: number;
      fetchFn?: typeof fetch;
    },
  ) {}

  async send(input: LiveAgentInput) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await (this.config.fetchFn ?? fetch)(this.config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.token}`,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new LiveAgentAuthError();
      }

      if (!response.ok) {
        const bodyText = await response.text();
        throw new LiveAgentRequestError(
          `Live agent runtime request failed with status ${response.status}${bodyText ? `: ${bodyText}` : ""}`,
        );
      }

      const body = await response.json();
      return liveAgentResultSchema.parse(body);
    } catch (error) {
      if (error instanceof LiveAgentAuthError || error instanceof LiveAgentRequestError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new LiveAgentRequestError("Live agent runtime request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function isLiveAgentRuntimeConfigured() {
  const env = getCrmEnv();
  return env.crmE2ePlatformFixturesEnabled || Boolean(env.liveAgentUrl && env.liveAgentToken);
}

export function createLiveAgentAdapter(config?: {
  url?: string | null;
  token?: string | null;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}) {
  const env = getCrmEnv();
  const url = config?.url ?? env.liveAgentUrl;
  const token = config?.token ?? env.liveAgentToken;
  const timeoutMs = config?.timeoutMs ?? env.liveAgentTimeoutMs;

  if (!url || !token) {
    throw new LiveAgentNotConfiguredError();
  }

  return new HttpLiveAgentAdapter({
    url,
    token,
    timeoutMs,
    fetchFn: config?.fetchFn,
  });
}
