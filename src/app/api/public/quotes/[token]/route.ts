import { NextResponse } from "next/server";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const supabase = await createCrmServerClient();
    const { data, error } = await supabase.schema("crm").rpc("quote_by_public_token", { p_token: token });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Quote not found or link expired." }, { status: 404 });
    }
    return NextResponse.json({ quote: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load quote." },
      { status: 500 },
    );
  }
}
