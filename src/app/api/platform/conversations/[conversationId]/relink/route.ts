import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError, jsonSuccess, normalizeBlankFields, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getPlatformConversationLink, upsertPlatformConversationLink } from "@/modules/platform/lib/repository";

const relinkSchema = z.object({
  customer_id: z.uuid().nullable().optional(),
  job_id: z.uuid().nullable().optional(),
});

async function findCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .eq("archived", false)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function findJob(
  supabase: SupabaseClient,
  tenantId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .schema("crm")
    .from("jobs")
    .select("id, customer_id")
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle<{ id: string; customer_id: string | null }>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function updateLeadCustomerReference(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string,
  customerId: string | null,
) {
  const { error } = await supabase
    .schema("crm")
    .from("leads")
    .update({
      tenant_id: tenantId,
      customer_id: customerId,
    })
    .eq("tenant_id", tenantId)
    .eq("id", leadId);

  if (error) {
    throw error;
  }
}

async function updateAppointmentLinks(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string,
  customerId: string | null,
  jobId: string | null,
) {
  const { error } = await supabase
    .schema("crm")
    .from("appointments")
    .update({
      tenant_id: tenantId,
      customer_id: customerId,
      job_id: jobId,
    })
    .eq("tenant_id", tenantId)
    .eq("id", appointmentId);

  if (error) {
    throw error;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const auth = await requireCrmApiUser(["management", "admin", "sales", "accounts"]);
    if ("error" in auth) {
      return auth.error;
    }

    const params = await context.params;
    const conversationId = params.conversationId?.trim();
    if (!conversationId) {
      return jsonError("Conversation ID is required.");
    }

    const body = normalizeBlankFields(await request.json(), ["customer_id", "job_id"]);
    const parsed = relinkSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid relink payload.");
    }

    const { supabase, tenant, user } = auth.session;
    const link = await getPlatformConversationLink(supabase, tenant.id, conversationId);
    if (!link) {
      return jsonError("Platform conversation link not found.", 404);
    }

    const hasCustomerField = Object.prototype.hasOwnProperty.call(body, "customer_id");
    const hasJobField = Object.prototype.hasOwnProperty.call(body, "job_id");
    const requestedCustomerId = hasCustomerField ? (parsed.data.customer_id ?? null) : undefined;
    const requestedJobId = hasJobField ? (parsed.data.job_id ?? null) : undefined;

    let nextCustomerId = link.customer_id;
    let nextJobId = link.job_id;

    if (hasCustomerField) {
      if (requestedCustomerId === null || requestedCustomerId === undefined) {
        nextCustomerId = null;
        if (!hasJobField) {
          nextJobId = null;
        }
      } else {
        const customer = await findCustomer(supabase, tenant.id, requestedCustomerId);
        if (!customer) {
          return jsonError("Customer not found for this workspace.", 404);
        }
        nextCustomerId = customer.id;
        if (!hasJobField && customer.id !== link.customer_id) {
          nextJobId = null;
        }
      }
    }

    if (hasJobField) {
      if (requestedJobId === null || requestedJobId === undefined) {
        nextJobId = null;
      } else {
        const job = await findJob(supabase, tenant.id, requestedJobId);
        if (!job) {
          return jsonError("Job not found for this workspace.", 404);
        }
        if (nextCustomerId !== null && job.customer_id !== null && job.customer_id !== nextCustomerId) {
          return jsonError("Selected job belongs to a different customer.", 400);
        }
        nextJobId = job.id;
        nextCustomerId = job.customer_id ?? nextCustomerId;
      }
    }

    const nowIso = new Date().toISOString();
    const updatedLink = await upsertPlatformConversationLink(
      supabase,
      {
        workspace_id: link.workspace_id,
        tenant_id: tenant.id,
        created_at: link.created_at,
        updated_at: link.updated_at,
      },
      {
        conversationId,
        customerId: nextCustomerId,
        jobId: nextJobId,
        latestEventAt: nowIso,
        metadata: {
          manually_relinked_at: nowIso,
          manually_relinked_by: user.id,
        },
      },
    );

    if (link.lead_id) {
      await updateLeadCustomerReference(supabase, tenant.id, link.lead_id, nextCustomerId);
    }

    for (const appointmentId of [link.callback_appointment_id, link.booking_appointment_id].filter(
      (value): value is string => Boolean(value),
    )) {
      await updateAppointmentLinks(supabase, tenant.id, appointmentId, nextCustomerId, nextJobId);
    }

    return jsonSuccess({ link: updatedLink });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to relink conversation.", 400);
  }
}
