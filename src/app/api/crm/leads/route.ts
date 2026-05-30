import { leadSchema } from "@/modules/crm/lib/validation";
import { extractCustomFieldValues, upsertCustomFieldValues } from "@/modules/crm/lib/custom-fields";
import { jsonError, jsonSuccess, paginationFromRequestUrl, requireCrmApiUser } from "@/modules/crm/lib/api";
import { validateRequiredProgression } from "@/modules/crm/lib/rules";
import { getEnquiryCounts, listLeads, type EnquiryTab } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { normalizeCrmPagination } from "@/modules/crm/lib/performance";
import { listBookingRecoveryCases } from "@/modules/platform/lib/booking-recovery";

function parseTab(value: string | null): EnquiryTab {
  return value === "done" || value === "all" ? value : "todo";
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
  const [items, counts, recoveryCases] = await Promise.all([
    listLeads(demoState.mode, pagination, tab),
    getEnquiryCounts(demoState.mode),
    demoState.mode === "live"
      ? listBookingRecoveryCases(auth.session.supabase, auth.session.tenant.id).catch(() => [])
      : Promise.resolve([]),
  ]);
  const reviewCount = tab === "done" ? 0 : recoveryCases.length;
  return jsonSuccess({
    items,
    recoveryCases: tab === "todo" || tab === "all" ? recoveryCases : [],
    counts: {
      todoCount: counts.todoCount + recoveryCases.length,
      doneCount: counts.doneCount,
      allCount: counts.allCount + recoveryCases.length,
    },
    pagination: normalizeCrmPagination(pagination),
    visibleCount: items.length + reviewCount,
  });
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

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("leads").insert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  await upsertCustomFieldValues({
    entityType: "lead",
    entityId: data.id,
    values: customFieldValues,
  });

  return jsonSuccess({ lead: data });
}
