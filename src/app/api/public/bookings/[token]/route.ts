import { NextResponse } from "next/server";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { getAppointmentForSelfServiceToken } from "@/modules/crm/lib/self-service-booking";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await getAppointmentForSelfServiceToken(createCrmServiceRoleClient(), token);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid or expired booking link." }, { status: 404 });
  }
  return NextResponse.json({ appointment: resolved.appointment, expires_at: resolved.tokenRow.expires_at });
}
