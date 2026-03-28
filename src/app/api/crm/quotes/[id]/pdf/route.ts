export const runtime = "nodejs";

import { renderQuotePdf } from "@/modules/crm/lib/pdf";
import { getQuoteDetail } from "@/modules/crm/lib/data";
import { requireCrmApiUser } from "@/modules/crm/lib/api";
import type { TenantSettings } from "@/modules/crm/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const quote = await getQuoteDetail(id);
  if (!quote) {
    return new Response("Not found", { status: 404 });
  }

  const { data: tenantSettings } = await auth.session.supabase
    .schema("crm")
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", auth.session.tenant.id)
    .maybeSingle<TenantSettings>();

  const buffer = await renderQuotePdf(quote, {
    branding: auth.session.branding ?? null,
    settings: tenantSettings ?? null,
  });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quote_number}.pdf"`,
    },
  });
}
