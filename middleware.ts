import type { NextRequest } from "next/server";
import { updateCrmSession } from "@/modules/crm/lib/supabase-middleware";

export async function middleware(request: NextRequest) {
  return updateCrmSession(request);
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/leads/:path*", "/customers/:path*", "/jobs/:path*", "/calendar/:path*", "/quotes/:path*", "/invoices/:path*", "/staff/:path*", "/reports/:path*", "/settings/:path*", "/api/crm/:path*"],
};
