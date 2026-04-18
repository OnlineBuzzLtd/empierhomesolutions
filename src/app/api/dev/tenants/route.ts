import { NextResponse } from "next/server";
import { getCrmEnv } from "@/modules/crm/lib/env";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

function isLocalOrDevEnabled() {
  if (process.env.DEV_TEST_UI_ENABLED === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function GET() {
  if (!isLocalOrDevEnabled()) {
    return NextResponse.json(
      { error: "Dev tenant list is disabled. Set DEV_TEST_UI_ENABLED=1 or run in development." },
      { status: 403 },
    );
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
