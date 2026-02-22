import { getServerEnv, publicEnv } from "@/lib/env";
import type { Attribution } from "@/modules/tracking/attribution";
import { z } from "zod";

const attributionSchema = z
  .object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
    gclid: z.string().optional(),
    msclkid: z.string().optional(),
    landing_url: z.string().optional(),
  })
  .optional()
  .default({});

export const leadRequestSchema = z.object({
  name: z.string().min(2),
  postcode: z.string().min(4),
  phone: z.string().min(10).max(15),
  issue: z.string().default(""),
  companyWebsite: z.string().optional().default(""),
  pagePath: z.string().min(1),
  service: z.string().optional(),
  location: z.string().optional(),
  leadType: z.enum(["repair", "install", "finance", "power-flush"]).default("repair"),
  origin: z.string().url(),
  attribution: attributionSchema,
});

export type LeadRequest = z.infer<typeof leadRequestSchema>;

function sanitizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isAllowedOrigin(origin: string) {
  if (origin === publicEnv.siteUrl) {
    return true;
  }

  try {
    const requestOrigin = new URL(origin);
    const allowedOrigin = new URL(publicEnv.siteUrl);
    const loopbackHosts = new Set(["localhost", "127.0.0.1"]);

    return (
      requestOrigin.protocol === allowedOrigin.protocol &&
      requestOrigin.port === allowedOrigin.port &&
      loopbackHosts.has(requestOrigin.hostname) &&
      loopbackHosts.has(allowedOrigin.hostname)
    );
  } catch {
    return false;
  }
}

function sanitizeAttribution(attribution: Attribution = {}) {
  return Object.fromEntries(
    Object.entries(attribution)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => [key, sanitizeText(String(value))]),
  );
}

export function sanitizeLeadPayload(lead: LeadRequest) {
  const normalizedIssue = lead.issue ? sanitizeText(lead.issue) : "";

  return {
    name: sanitizeText(lead.name),
    postcode: sanitizeText(lead.postcode.toUpperCase()),
    phone: sanitizeText(lead.phone),
    issue: normalizedIssue || "Not provided",
    leadType: lead.leadType,
    metadata: {
      timestamp: new Date().toISOString(),
      pagePath: sanitizeText(lead.pagePath),
      service: lead.service ? sanitizeText(lead.service) : "",
      location: lead.location ? sanitizeText(lead.location) : "",
    },
    attribution: sanitizeAttribution(lead.attribution),
  };
}

export type LeadSubmitResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: {
        code: string;
        message: string;
      };
    };

export async function submitLeadToWebhook(lead: LeadRequest): Promise<LeadSubmitResult> {
  if (!isAllowedOrigin(lead.origin)) {
    return {
      ok: false,
      status: 403,
      error: {
        code: "invalid_origin",
        message: "Origin is not allowed.",
      },
    };
  }

  if (lead.companyWebsite?.trim()) {
    return {
      ok: false,
      status: 422,
      error: {
        code: "spam_detected",
        message: "Spam validation failed.",
      },
    };
  }

  const cleanPayload = sanitizeLeadPayload(lead);

  try {
    const serverEnv = getServerEnv();
    const webhookResponse = await fetch(serverEnv.formWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanPayload),
      cache: "no-store",
    });

    if (!webhookResponse.ok) {
      return {
        ok: false,
        status: 502,
        error: {
          code: "webhook_failed",
          message: `Webhook rejected request with status ${webhookResponse.status}.`,
        },
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: {
        code: "webhook_unreachable",
        message: "Webhook endpoint could not be reached.",
      },
    };
  }
}
