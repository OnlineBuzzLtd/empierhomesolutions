import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ZodSchema } from "zod";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { buildInvoiceNumber, buildQuoteNumber } from "@/modules/crm/lib/numbers";
import type { CrmRole, LineItem, UserProfile } from "@/modules/crm/types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonSuccess(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

export type CrmApiSession = {
  supabase: Awaited<ReturnType<typeof createCrmServerClient>>;
  user: User;
  profile: UserProfile | null;
};

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json();
  return schema.safeParse(body);
}

export function parseLineItems(value: unknown) {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      return [];
    }
    return JSON.parse(value) as LineItem[];
  }
  return value as LineItem[];
}

export function computeFinancials(lineItems: LineItem[], vatRate: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price), 0);
  const total = subtotal + subtotal * vatRate;
  return { subtotal, total };
}

export async function nextQuoteNumber() {
  const supabase = await createCrmServerClient();
  const { data, error } = await supabase.rpc("next_sequence", { p_sequence_key: "quote" });
  if (error) {
    throw error;
  }
  return buildQuoteNumber(Number(data));
}

export async function nextInvoiceNumber() {
  const supabase = await createCrmServerClient();
  const { data, error } = await supabase.rpc("next_sequence", { p_sequence_key: "invoice" });
  if (error) {
    throw error;
  }
  return buildInvoiceNumber(Number(data));
}

export async function requireCrmApiUser(allowedRoles?: CrmRole[]) {
  const supabase = await createCrmServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: jsonError("Authentication required.", 401) };
  }

  const { data: profile } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<UserProfile>();

  if (allowedRoles?.length) {
    const role = profile?.role;
    if (!role || !allowedRoles.includes(role)) {
      return { error: jsonError("You do not have access to this CRM action.", 403) };
    }
  }

  return {
    session: {
      supabase,
      user,
      profile: profile ?? null,
    } satisfies CrmApiSession,
  };
}

export async function requireManagerCrmApiUser() {
  return requireCrmApiUser(["management", "admin"]);
}
