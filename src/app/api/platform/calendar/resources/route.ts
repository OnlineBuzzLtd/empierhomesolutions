// Phase I — GET /api/platform/calendar/resources
//
// Lists the CRM-side engineer/team calendar resources the platform
// can book against. Each row in crm.user_profiles with role='engineer'
// and active=true becomes a resource. The platform stores the
// resource's `id` as booking_resources.resource_ref so future
// hold/confirm calls reference it.

import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { verifyPlatformRequest } from "@/modules/platform/lib/platform-auth";

export async function GET(request: Request) {
  const env = getCrmEnv();
  if (!env.platformSharedSecret) {
    return NextResponse.json({ error: "Platform shared secret is not configured." }, { status: 503 });
  }

  const auth = verifyPlatformRequest(request, "", env.platformSharedSecret);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createCrmServiceRoleClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("id, full_name, role, active")
    .eq("role", "engineer")
    .eq("active", true)
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resources = (data ?? []).map((row, index) => ({
    externalId: row.id,
    displayName: row.full_name,
    description: null,
    timeZone: "Europe/London",
    primary: index === 0,
    accessRole: "writer",
  }));

  return NextResponse.json({ resources });
}
