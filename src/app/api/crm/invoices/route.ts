import { jsonSuccess, paginationFromRequestUrl, requireCrmApiUser } from "@/modules/crm/lib/api";
import { listInvoices } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { normalizeCrmPagination } from "@/modules/crm/lib/performance";

export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const pagination = paginationFromRequestUrl(request);
  const demoState = await getCrmDemoState();
  const items = await listInvoices(demoState.mode, pagination);
  return jsonSuccess({ items, pagination: normalizeCrmPagination(pagination) });
}
