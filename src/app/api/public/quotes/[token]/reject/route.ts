import { NextResponse } from "next/server";
import { publicRejectSchema } from "@/modules/crm/lib/validation";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = publicRejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid rejection payload." },
        { status: 400 },
      );
    }

    const supabase = await createCrmServerClient();
    const { data, error } = await supabase.schema("crm").rpc("reject_quote_by_token", {
      p_token: token,
      p_reason: parsed.data.reason ?? null,
    });
    if (error) {
      const status = /not_found_or_expired/i.test(error.message) ? 404 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ ok: true, ...((data as Record<string, unknown>) ?? {}) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject quote." },
      { status: 500 },
    );
  }
}
