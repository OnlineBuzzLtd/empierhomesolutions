import { jsonError, jsonSuccess, requireCrmApiUser, resolveCreatedByUserId } from "@/modules/crm/lib/api";
import { dispatchDueNotifications, scheduleNotification } from "@/modules/crm/notifications/scheduler";
import { renderNotificationTemplate } from "@/modules/crm/notifications/render";

type EnRouteJobRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  is_test?: boolean | null;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    postcode: string | null;
  } | null;
  site_contact?: {
    full_name: string | null;
    phone: string | null;
  } | null;
  site?: {
    address_line1: string | null;
    city: string | null;
    postcode: string | null;
  } | null;
};

type SupabaseRelation<T> = T | T[] | null | undefined;

function cleanPhone(value: string | null | undefined) {
  const phone = value?.trim();
  return phone && phone.length > 0 ? phone : null;
}

function firstRelation<T>(value: SupabaseRelation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function buildTenMinuteIdempotencyKey(jobId: string, now: Date) {
  return `job:${jobId}:en_route:${Math.floor(now.getTime() / (10 * 60 * 1000))}`;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase, tenant, user } = auth.session;
    const { data, error } = await supabase
      .schema("crm")
      .from("jobs")
      .select(
        "id, tenant_id, title, status, is_test, customer:customers(id, full_name, phone, postcode), site_contact:site_contacts(full_name, phone), site:sites(address_line1, city, postcode)",
      )
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (error || !data) {
      return jsonError(error?.message ?? "Job not found.", error ? 500 : 404);
    }

    const row = data as unknown as Omit<EnRouteJobRow, "customer" | "site_contact" | "site"> & {
      customer: SupabaseRelation<NonNullable<EnRouteJobRow["customer"]>>;
      site_contact: SupabaseRelation<NonNullable<EnRouteJobRow["site_contact"]>>;
      site: SupabaseRelation<NonNullable<EnRouteJobRow["site"]>>;
    };
    const job: EnRouteJobRow = {
      ...row,
      customer: firstRelation(row.customer),
      site_contact: firstRelation(row.site_contact),
      site: firstRelation(row.site),
    };
    if (job.status === "completed" || job.status === "invoiced" || job.status === "aborted") {
      return jsonError("Cannot send en-route message for a closed job.");
    }

    const recipient =
      cleanPhone(job.site_contact?.phone) ??
      cleanPhone(job.customer?.phone);
    if (!recipient) {
      return jsonError("Customer phone number is required before sending an en-route message.");
    }

    const now = new Date();
    const since = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await supabase
      .schema("crm")
      .from("scheduled_notifications")
      .select("id, status, created_at")
      .eq("tenant_id", tenant.id)
      .in("status", ["pending", "sent"])
      .eq("metadata->>job_id", id)
      .eq("metadata->>notification_type", "en_route")
      .gte("created_at", since)
      .limit(1);

    if (recentError) {
      return jsonError(recentError.message, 500);
    }

    if ((recent ?? []).length > 0) {
      return jsonSuccess({ alreadySent: true, notification: recent?.[0] ?? null });
    }

    const customerName =
      job.site_contact?.full_name?.trim() ||
      job.customer?.full_name?.trim() ||
      "there";
    const siteAddress = [job.site?.address_line1, job.site?.city, job.site?.postcode].filter(Boolean).join(", ");
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId: tenant.id,
      key: "en_route_sms",
      channel: "sms",
      variables: {
        customer_name: customerName,
        job_title: job.title,
        site_address: siteAddress || job.customer?.postcode || "",
      },
    });

    const notification = await scheduleNotification(supabase, {
      tenantId: tenant.id,
      recipient,
      channel: "sms",
      templateKey: rendered.template.key,
      payload: { body: rendered.body },
      dispatchAt: now,
      idempotencyKey: buildTenMinuteIdempotencyKey(id, now),
      isTest: job.is_test === true,
      metadata: {
        job_id: id,
        customer_id: job.customer?.id ?? null,
        notification_type: "en_route",
      },
    });

    const dispatch = await dispatchDueNotifications(supabase, {
      now,
      onlyId: String(notification.id),
      limit: 1,
    });

    await supabase.schema("crm").from("notes").insert({
      tenant_id: tenant.id,
      entity_type: "job",
      entity_id: id,
      body: dispatch.sent > 0 ? "En-route SMS sent to customer." : "En-route SMS queued for customer.",
      created_by: resolveCreatedByUserId(user),
    });

    return jsonSuccess({ notification, dispatch });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to send en-route message.", 400);
  }
}
