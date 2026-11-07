import { resolveTenantFromHost } from "@/lib/tenant-host";

export const EMPIRE_CRM_TENANT = "11111111-1111-4111-8111-111111111111";
export const ENQUIRY_FORM = "/lp/boiler-repair/uxbridge#lead-form";

// Resolve the host ourselves too: a caller cannot bypass the retirement gate
// by submitting a forged x-tenant-slug header to an Empire host.
export function isEmpireWebsiteHost(host: string | null) {
  const { slug } = resolveTenantFromHost(host);
  return !slug || slug === "empire-home-solutions" || slug === "empire";
}
