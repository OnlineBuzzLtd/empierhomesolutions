import { jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { searchCustomerMatchCandidates } from "@/modules/crm/lib/data";

export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const demoState = await getCrmDemoState();
  const candidates = await searchCustomerMatchCandidates(
    {
      fullName: url.searchParams.get("name"),
      phone: url.searchParams.get("phone"),
      email: url.searchParams.get("email"),
      postcode: url.searchParams.get("postcode"),
    },
    demoState.mode,
  );

  return jsonSuccess({ candidates });
}
