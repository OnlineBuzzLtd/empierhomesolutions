import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { createAppointmentSelfServiceToken } from "@/modules/crm/lib/self-service-booking";

function getBaseUrl(request: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser(["management", "admin", "sales", "accounts"]);
  if ("error" in auth) {
    return auth.error;
  }
  const { id } = await params;
  const { supabase, tenant } = auth.session;
  const { data: appointment, error } = await supabase
    .schema("crm")
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return jsonError(error.message, 500);
  }
  if (!appointment) {
    return jsonError("Appointment not found.", 404);
  }

  const { token, expiresAt } = await createAppointmentSelfServiceToken(supabase, {
    tenantId: tenant.id,
    appointmentId: id,
  });
  return jsonSuccess({
    token,
    expires_at: expiresAt,
    url: `${getBaseUrl(request)}/booking/${encodeURIComponent(token)}`,
  });
}
