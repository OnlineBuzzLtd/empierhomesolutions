import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { listCustomers, listInvoices, listJobs, listLeadsStrict, listQuotes } from "@/modules/crm/lib/data";
import { buildCrmSearchResults, normalizeCrmSearchQuery } from "@/modules/crm/lib/search";

const searchPagination = { pageSize: 250 };

export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const query = normalizeCrmSearchQuery(new URL(request.url).searchParams.get("q"));
  if (query.length < 2) {
    return jsonSuccess({ query, items: [] });
  }

  const demoState = await getCrmDemoState();
  try {
    const [customers, leads, jobs, quotes, invoices] = await Promise.all([
      listCustomers(demoState.mode, searchPagination),
      listLeadsStrict(demoState.mode, searchPagination, "all"),
      listJobs(demoState.mode, searchPagination),
      listQuotes(demoState.mode, searchPagination),
      listInvoices(demoState.mode, searchPagination),
    ]);

    return jsonSuccess({
      query,
      items: buildCrmSearchResults(query, {
        customers,
        leads,
        jobs,
        quotes,
        invoices,
      }),
    });
  } catch (error) {
    console.error("[crm.search.GET] failed to search CRM", error);
    return jsonError("CRM search could not be loaded. Please try again.", 500);
  }
}
