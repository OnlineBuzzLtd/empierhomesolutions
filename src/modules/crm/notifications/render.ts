import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduledNotificationChannel } from "@/modules/crm/notifications/scheduler";

export type NotificationTemplate = {
  id: string;
  tenant_id: string | null;
  key: string;
  channel: ScheduledNotificationChannel;
  locale: string;
  subject: string | null;
  body: string;
  variables: string[];
  active: boolean;
};

export type RenderedNotification = {
  template: NotificationTemplate;
  subject: string | null;
  body: string;
};

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function stringifyTemplateValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return null;
}

export function renderTemplateString(template: string, variables: Record<string, unknown>) {
  const missing = new Set<string>();
  const body = template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    const value = stringifyTemplateValue(variables[key]);
    if (value === null) {
      missing.add(key);
      return "";
    }
    return value;
  });

  if (missing.size > 0) {
    throw new Error(`Missing notification template variables: ${[...missing].sort().join(", ")}`);
  }

  return body;
}

function normalizeTemplate(row: Record<string, unknown>): NotificationTemplate {
  const variables = Array.isArray(row.variables)
    ? row.variables.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id: String(row.id),
    tenant_id: typeof row.tenant_id === "string" ? row.tenant_id : null,
    key: String(row.key),
    channel: row.channel as ScheduledNotificationChannel,
    locale: String(row.locale ?? "en-GB"),
    subject: typeof row.subject === "string" ? row.subject : null,
    body: String(row.body ?? ""),
    variables,
    active: row.active !== false,
  };
}

export async function getNotificationTemplate(
  supabase: SupabaseClient,
  input: { tenantId: string; key: string; channel: ScheduledNotificationChannel; locale?: string },
) {
  const locale = input.locale ?? "en-GB";
  const { data, error } = await supabase
    .schema("crm")
    .from("notification_templates")
    .select("*")
    .eq("key", input.key)
    .eq("channel", input.channel)
    .eq("locale", locale)
    .eq("active", true)
    .or(`tenant_id.eq.${input.tenantId},tenant_id.is.null`);

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map(normalizeTemplate);
  return rows.find((row) => row.tenant_id === input.tenantId) ?? rows.find((row) => row.tenant_id === null) ?? null;
}

export async function renderNotificationTemplate(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    key: string;
    channel: ScheduledNotificationChannel;
    locale?: string;
    variables: Record<string, unknown>;
  },
): Promise<RenderedNotification> {
  const template = await getNotificationTemplate(supabase, input);
  if (!template) {
    throw new Error(`Notification template not found: ${input.key}/${input.channel}/${input.locale ?? "en-GB"}`);
  }

  return {
    template,
    subject: template.subject ? renderTemplateString(template.subject, input.variables) : null,
    body: renderTemplateString(template.body, input.variables),
  };
}

export async function listNotificationTemplates(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .schema("crm")
    .from("notification_templates")
    .select("*")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("key", { ascending: true })
    .order("channel", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeTemplate);
}
