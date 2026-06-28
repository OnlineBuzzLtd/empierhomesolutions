import { customerPromiseSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import {
  createCustomerPromiseWithClient,
  listCustomerPromises,
  type CustomerPromiseFilters,
} from "@/modules/crm/lib/customer-promises";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";

export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const demoState = await getCrmDemoState();
  const requestedLimit = Number(url.searchParams.get("limit") ?? 25);
  const filters: CustomerPromiseFilters = {
    customerId: url.searchParams.get("customerId"),
    leadId: url.searchParams.get("leadId"),
    jobId: url.searchParams.get("jobId"),
    quoteId: url.searchParams.get("quoteId"),
    invoiceId: url.searchParams.get("invoiceId"),
    status: url.searchParams.get("status") === "all" ? undefined : "open",
    limit: Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 25,
  };
  const promises = await listCustomerPromises(filters, demoState.mode);
  return jsonSuccess({ promises });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = customerPromiseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid customer promise.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const promise = await createCustomerPromiseWithClient(auth.session.supabase, {
      ...parsed.data,
      tenant_id: auth.session.tenant.id,
      created_by: auth.session.user.id,
      updated_by: auth.session.user.id,
    });
    return jsonSuccess({ promise });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save customer promise.", 500);
  }
}
