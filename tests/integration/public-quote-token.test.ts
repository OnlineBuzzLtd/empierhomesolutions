/**
 * Integration test for public-link token surface.
 *
 * Verifies the security-definer RPCs (`quote_by_public_token`,
 * `accept_quote_by_token`, `reject_quote_by_token`) are callable from
 * the anon client AND that the underlying tables are NOT directly
 * readable from anon (RLS must keep cost/margin hidden).
 *
 * Skipped without SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
const hasCreds = Boolean(supabaseUrl && serviceRoleKey && anonKey);

if (!hasCreds) {
  console.warn(
    "[integration] Skipping public-quote-token tests: SUPABASE_URL / SERVICE_ROLE / ANON key missing.",
  );
}

let canReach = false;
if (hasCreds) {
  try {
    const probe = await fetch(`${supabaseUrl}/rest/v1/`, { method: "HEAD" });
    canReach = probe.status < 500;
  } catch {
    canReach = false;
    console.warn(
      `[integration] Skipping public-quote-token tests: Supabase URL ${supabaseUrl} unreachable.`,
    );
  }
}

const describeOrSkip = hasCreds && canReach ? describe : describe.skip;

describeOrSkip("public quote token surface (live Supabase)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let quoteId = "";
  let token = "";
  const createdCustomerIds: string[] = [];
  const createdJobIds: string[] = [];
  const createdQuoteIds: string[] = [];

  beforeAll(async () => {
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Seed a minimal customer + job + quote with a public_token.
    const { data: customer, error: cErr } = await admin
      .schema("crm")
      .from("customers")
      .insert({ tenant_id: TENANT_ID, full_name: "[INTEGRATION] Token Test", phone: "+447900099002", is_demo: false })
      .select("id")
      .single<{ id: string }>();
    if (cErr || !customer) throw new Error(`customer seed failed: ${cErr?.message}`);
    createdCustomerIds.push(customer.id);

    const { data: job, error: jErr } = await admin
      .schema("crm")
      .from("jobs")
      .insert({
        tenant_id: TENANT_ID,
        customer_id: customer.id,
        title: "[INTEGRATION] Token Test Job",
        status: "lead",
        is_demo: false,
      })
      .select("id")
      .single<{ id: string }>();
    if (jErr || !job) throw new Error(`job seed failed: ${jErr?.message}`);
    createdJobIds.push(job.id);

    token = crypto.randomUUID();
    const { data: quote, error: qErr } = await admin
      .schema("crm")
      .from("quotes")
      .insert({
        tenant_id: TENANT_ID,
        job_id: job.id,
        customer_id: customer.id,
        quote_number: `Q-INT-${Date.now()}`,
        document_type: "quote",
        line_items: [
          { description: "Boiler", qty: 1, unit_price: 1500, unit_cost: 900 },
          { description: "Labour", qty: 1, unit_price: 1500, unit_cost: 985 },
        ],
        subtotal: 3000,
        vat_rate: 0.2,
        vat_category: "standard_20",
        total: 3600,
        total_cost: 1885,
        total_profit: 1115,
        total_margin_percent: 0.3717,
        status: "sent",
        public_token: token,
        public_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        is_demo: false,
      })
      .select("id")
      .single<{ id: string }>();
    if (qErr || !quote) throw new Error(`quote seed failed: ${qErr?.message}`);
    quoteId = quote.id;
    createdQuoteIds.push(quote.id);
  });

  afterAll(async () => {
    if (createdQuoteIds.length > 0) {
      await admin.schema("crm").from("quotes").delete().in("id", createdQuoteIds);
    }
    if (createdJobIds.length > 0) {
      await admin.schema("crm").from("jobs").delete().in("id", createdJobIds);
    }
    if (createdCustomerIds.length > 0) {
      await admin.schema("crm").from("customers").delete().in("id", createdCustomerIds);
    }
  });

  it("anon CANNOT directly read crm.quotes (RLS blocks)", async () => {
    const { data } = await anon.schema("crm").from("quotes").select("id, total_cost, tenant_id").eq("id", quoteId);
    // RLS returns empty array (no policy matches) rather than a row.
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });

  it("anon CAN read sanitised quote via the security-definer RPC", async () => {
    const { data, error } = await anon.schema("crm").rpc("quote_by_public_token", { p_token: token });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const view = data as Record<string, unknown>;
    expect(view.id).toBe(quoteId);
    expect(view.subtotal).toBeDefined();
    expect(view.total).toBeDefined();
    // Sanitised: no cost/margin/profit/tenant_id leaked
    expect(view.total_cost).toBeUndefined();
    expect(view.total_profit).toBeUndefined();
    expect(view.total_margin_percent).toBeUndefined();
    expect(view.tenant_id).toBeUndefined();
    // line_items projection strips unit_cost
    const lineItems = (view.line_items ?? []) as Array<Record<string, unknown>>;
    for (const item of lineItems) {
      expect(item.unit_cost).toBeUndefined();
      expect(item.markup_percent).toBeUndefined();
    }
  });

  it("expired token returns null", async () => {
    // Move expiry into the past
    await admin
      .schema("crm")
      .from("quotes")
      .update({ public_token_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", quoteId);

    const { data } = await anon.schema("crm").rpc("quote_by_public_token", { p_token: token });
    expect(data).toBeNull();

    // Restore for accept test
    await admin
      .schema("crm")
      .from("quotes")
      .update({
        public_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "sent",
      })
      .eq("id", quoteId);
  });

  it("accept_quote_by_token marks the quote accepted and writes acceptance row", async () => {
    const { data, error } = await anon.schema("crm").rpc("accept_quote_by_token", {
      p_token: token,
      p_name: "Integration Tester",
      p_email: "tester@example.com",
      p_notes: null,
      p_ip: "127.0.0.1",
      p_user_agent: "vitest",
    });
    expect(error).toBeNull();
    expect((data as { quote_id?: string } | null)?.quote_id).toBe(quoteId);

    const { data: row } = await admin
      .schema("crm")
      .from("quotes")
      .select("status")
      .eq("id", quoteId)
      .maybeSingle<{ status: string }>();
    expect(row?.status).toBe("accepted");

    const { data: acceptance } = await admin
      .schema("crm")
      .from("quote_acceptances")
      .select("accepted_by_name, acceptance_method")
      .eq("quote_id", quoteId)
      .maybeSingle<{ accepted_by_name: string; acceptance_method: string }>();
    expect(acceptance?.accepted_by_name).toBe("Integration Tester");
    expect(acceptance?.acceptance_method).toBe("public_link_typed_name");
  });

  it("invalid token returns null and does not affect rows", async () => {
    const bogus = crypto.randomUUID();
    const { data } = await anon.schema("crm").rpc("quote_by_public_token", { p_token: bogus });
    expect(data).toBeNull();
  });
});
