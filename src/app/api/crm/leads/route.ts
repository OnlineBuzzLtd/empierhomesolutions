import { leadSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess, paginationFromRequestUrl, requireCrmApiUser, type CrmApiSession } from "@/modules/crm/lib/api";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";
import {
  getEnquiryCounts,
  listCustomers,
  listJobTypes,
  listLeadsStrict,
  listServices,
  listUserProfiles,
  type EnquiryTab,
} from "@/modules/crm/lib/data";
import { createCustomerPromiseWithClient, listCustomerPromises } from "@/modules/crm/lib/customer-promises";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { normalizeCrmPagination } from "@/modules/crm/lib/performance";
import type { LeadCustomerMatchResult, LeadSource } from "@/modules/crm/types";

function parseTab(value: string | null): EnquiryTab {
  return value === "done" || value === "all" ? value : "todo";
}

type ManualLeadCustomerInput = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  postcode: string | null;
  source: string;
  notes: string | null;
};

type ManualLeadCustomerResult = {
  customerId: string | null;
  customerMatchResult: LeadCustomerMatchResult | null;
  matchedCustomerConfidence: string | null;
};

type CustomerMatchRow = {
  id: string;
  tenant_id?: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
};

function cleanText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function cleanEmail(value: unknown) {
  const email = cleanText(value)?.toLowerCase() ?? null;
  return email && email.includes("@") ? email : null;
}

function cleanPhone(value: unknown) {
  const phone = cleanText(value)?.replace(/[^\d+]/g, "") ?? null;
  return phone && phone.length > 0 ? phone : null;
}

function toLeadSourceEnum(source: string | null | undefined): LeadSource {
  const normalized = (source ?? "").toLowerCase();
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("sms")) return "sms";
  if (normalized.includes("email")) return "email";
  if (normalized.includes("google")) return "google_lead";
  if (normalized.includes("meta") || normalized.includes("facebook")) return "meta_lead";
  if (normalized.includes("webchat")) return "webchat";
  if (normalized.includes("form") || normalized.includes("landing")) return "landing_form";
  if (normalized.includes("manual") || normalized.length === 0) return "manual";
  return "other";
}

function buildManualCustomerInput(body: Record<string, unknown>, lead: { source?: string | null; notes?: string | null }): ManualLeadCustomerInput {
  return {
    fullName: cleanText(body.customer_full_name),
    phone: cleanPhone(body.customer_phone),
    email: cleanEmail(body.customer_email),
    postcode: cleanText(body.customer_postcode)?.toUpperCase() ?? null,
    source: cleanText(lead.source) ?? "Manual enquiry",
    notes: cleanText(lead.notes),
  };
}

async function findCustomerByContact(
  supabase: CrmApiSession["supabase"],
  tenantId: string,
  input: Pick<ManualLeadCustomerInput, "phone" | "email">,
) {
  if (input.phone) {
    const { data, error } = await supabase
      .schema("crm")
      .from("customers")
      .select("id, tenant_id, full_name, phone, email")
      .eq("tenant_id", tenantId)
      .eq("phone", input.phone)
      .eq("archived", false)
      .maybeSingle<CustomerMatchRow>();
    if (error) throw error;
    if (data) return data;
  }

  if (input.email) {
    const { data, error } = await supabase
      .schema("crm")
      .from("customers")
      .select("id, tenant_id, full_name, phone, email")
      .eq("tenant_id", tenantId)
      .eq("email", input.email)
      .eq("archived", false)
      .maybeSingle<CustomerMatchRow>();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function resolveManualLeadCustomer(
  supabase: CrmApiSession["supabase"],
  tenantId: string,
  selectedCustomerId: string | null | undefined,
  input: ManualLeadCustomerInput,
): Promise<ManualLeadCustomerResult> {
  if (selectedCustomerId) {
    return {
      customerId: selectedCustomerId,
      customerMatchResult: "matched",
      matchedCustomerConfidence: "manual_selected",
    };
  }

  const existingCustomer = await findCustomerByContact(supabase, tenantId, input);
  if (existingCustomer) {
    return {
      customerId: existingCustomer.id,
      customerMatchResult: "matched",
      matchedCustomerConfidence: "exact_contact",
    };
  }

  if (!input.fullName || (!input.phone && !input.email)) {
    return {
      customerId: null,
      customerMatchResult: null,
      matchedCustomerConfidence: null,
    };
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .insert({
      tenant_id: tenantId,
      full_name: input.fullName,
      phone: input.phone,
      email: input.email,
      postcode: input.postcode,
      source: input.source,
      source_enum: toLeadSourceEnum(input.source),
      notes: input.notes,
    })
    .select("id, tenant_id, full_name, phone, email")
    .single<CustomerMatchRow>();
  if (error) throw error;

  return {
    customerId: data.id,
    customerMatchResult: "new",
    matchedCustomerConfidence: "manual_created",
  };
}

export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const pagination = paginationFromRequestUrl(request);
  const searchParams = new URL(request.url).searchParams;
  const tab = parseTab(searchParams.get("tab"));
  const demoState = await getCrmDemoState();
  try {
    const [items, counts, customers, services, jobTypes, users, promises] = await Promise.all([
      listLeadsStrict(demoState.mode, pagination, tab),
      getEnquiryCounts(demoState.mode),
      listCustomers(demoState.mode, { pageSize: 250 }),
      listServices(),
      listJobTypes(),
      listUserProfiles(demoState.mode),
      listCustomerPromises({ status: "open", limit: 250 }, demoState.mode),
    ]);
    const usersByUserId = new Map(users.map((user) => [user.user_id, user]));
    const promisesByLeadId = new Map<string, typeof promises>();
    for (const promise of promises) {
      if (!promise.lead_id) continue;
      const existing = promisesByLeadId.get(promise.lead_id) ?? [];
      existing.push(promise);
      promisesByLeadId.set(promise.lead_id, existing);
    }
    const enrichedItems = items.map((lead) => {
      const owner = lead.assigned_to ? usersByUserId.get(lead.assigned_to) : null;
      return {
        ...lead,
        owner: owner ? { id: owner.id, full_name: owner.full_name, role: owner.role } : null,
        promises: promisesByLeadId.get(lead.id) ?? [],
      };
    });
    return jsonSuccess({
      items: enrichedItems,
      recoveryCases: [],
      counts: {
        todoCount: counts.todoCount,
        doneCount: counts.doneCount,
        allCount: counts.allCount,
      },
      lookups: {
        customers,
        services,
        jobTypes,
        engineers: users.filter((user) => user.active !== false && user.role === "engineer"),
        users: users.filter((user) => user.active !== false),
      },
      pagination: normalizeCrmPagination(pagination),
      visibleCount: enrichedItems.length,
    });
  } catch (error) {
    console.error("[crm.leads.GET] failed to load enquiries", error);
    return jsonError("Enquiries could not be loaded. Please refresh and try again.", 500);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid lead payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const customFieldValues = extractCustomFieldValues(body);
  const validation = await validateRequiredProgression({
    entityType: "lead",
    entityId: "",
    serviceId: parsed.data.service_id,
    jobTypeId: parsed.data.job_type_id,
    pipelineStage: parsed.data.status,
    incomingCustomFields: customFieldValues,
    skipDocumentCheck: true,
  });
  if (!validation.valid) {
    return jsonError(`Missing required fields: ${validation.missingFields.join(", ")}`);
  }

  const { supabase, tenant } = auth.session;
  let customerResolution: ManualLeadCustomerResult;
  const customerInput = buildManualCustomerInput(body, parsed.data);
  try {
    customerResolution = await resolveManualLeadCustomer(
      supabase,
      tenant.id,
      parsed.data.customer_id,
      customerInput,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Customer could not be matched or created.";
    return jsonError(message, 500);
  }

  const leadPayload = {
    ...parsed.data,
    tenant_id: tenant.id,
    customer_id: customerResolution.customerId,
    source_enum: toLeadSourceEnum(parsed.data.source),
    intake_source: "manual_crm",
    customer_match_result: customerResolution.customerMatchResult,
    matched_customer_confidence: customerResolution.matchedCustomerConfidence,
  };

  const { data, error } = await supabase.schema("crm").from("leads").insert(leadPayload).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  if (data.next_action_at) {
    try {
      await createCustomerPromiseWithClient(supabase, {
        tenant_id: tenant.id,
        customer_id: data.customer_id,
        lead_id: data.id,
        promise_type: "callback",
        title: "Enquiry follow-up",
        detail: data.problem_description ?? data.notes ?? "Follow up this customer enquiry.",
        owner_user_id: data.assigned_to,
        due_at: data.next_action_at,
        channel: customerInput.phone ? "phone" : customerInput.email ? "email" : "office",
        status: "open",
        origin: "office",
        idempotency_key: `lead:${data.id}:next_action:${data.next_action_at}`,
        created_by: auth.session.user.id,
        updated_by: auth.session.user.id,
        is_demo: Boolean(data.is_demo),
        demo_scenario_key: data.demo_scenario_key ?? null,
      });
    } catch (promiseError) {
      const message = promiseError instanceof Error ? promiseError.message : "Promise could not be saved.";
      return jsonError(message, 500);
    }
  }

  await upsertCustomFieldValues({
    entityType: "lead",
    entityId: data.id,
    values: customFieldValues,
  });

  return jsonSuccess({ lead: data });
}
