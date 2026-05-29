import { NextResponse } from "next/server";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { cancelSelfServiceAppointment } from "@/modules/crm/lib/self-service-booking";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await cancelSelfServiceAppointment(createCrmServiceRoleClient(), token);
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  if (!result.ok) {
    return NextResponse.json({ error: "Invalid or expired booking link." }, { status: 404 });
  }
  if (wantsJson) {
    return NextResponse.json(result);
  }
  return NextResponse.redirect(new URL(`/booking/${encodeURIComponent(token)}?status=cancelled`, request.url), 303);
}
