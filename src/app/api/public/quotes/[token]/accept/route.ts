import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { publicAcceptSchema } from "@/modules/crm/lib/validation";
import { createCrmServerClient, createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { clientIpFromHeaders } from "@/modules/crm/lib/public-quote";
import { recordUsageEvent } from "@/modules/crm/lib/usage-metering";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = publicAcceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid acceptance payload." },
        { status: 400 },
      );
    }

    const supabase = await createCrmServerClient();
    const headerStore = await headers();
    const ip = clientIpFromHeaders(headerStore);
    const userAgent = headerStore.get("user-agent");

    const { data, error } = await supabase.schema("crm").rpc("accept_quote_by_token", {
      p_token: token,
      p_name: parsed.data.accepted_by_name,
      p_email: parsed.data.accepted_by_email ?? null,
      p_notes: parsed.data.notes ?? null,
      p_ip: ip,
      p_user_agent: userAgent,
    });
    if (error) {
      const status = /not_found_or_expired/i.test(error.message) ? 404 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    const result = data as { quote_id?: string } | null;
    if (result?.quote_id) {
      // Resolve tenant via service role for metering (RLS would block
      // anon from reading tenant_id on crm.quotes, and the public RPC
      // sanitises tenant_id out). Best-effort: never throw.
      try {
        const admin = createCrmServiceRoleClient();
        const { data: quoteRow } = await admin
          .schema("crm")
          .from("quotes")
          .select("tenant_id")
          .eq("id", result.quote_id)
          .maybeSingle();
        const tenantId = (quoteRow as { tenant_id?: string } | null)?.tenant_id ?? null;
        if (tenantId) {
          await recordUsageEvent({
            tenantId,
            eventType: "quote_publicly_accepted",
            source: "public_link",
            metadata: { quote_id: result.quote_id },
          });
        }
      } catch {
        // metering is non-critical; accept already succeeded
      }
    }

    return NextResponse.json({ ok: true, ...((data as Record<string, unknown>) ?? {}) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to accept quote." },
      { status: 500 },
    );
  }
}
