import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { assertDevRouteAuthorized, isDevRouteAuthGrant } from "@/modules/crm/lib/dev-auth";

export async function GET() {
  const auth = await assertDevRouteAuthorized();
  if (!isDevRouteAuthGrant(auth)) {
    return auth.response;
  }

  const env = getCrmEnv();
  if (!env.adminEnabled) {
    return NextResponse.json(
      { error: "Supabase admin env is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = createCrmServiceRoleClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("tenants")
      .select("id, slug, name")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return NextResponse.json({ tenants: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list tenants." },
      { status: 500 },
    );
  }
}
