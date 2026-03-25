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

export function normalizeBlankFields<T extends Record<string, unknown>>(value: T, fields: Array<keyof T>) {
  const normalized: Record<string, unknown> = { ...value };

  for (const field of fields) {
    const key = String(field);
    if (normalized[key] === "") {
      normalized[key] = null;
    }
  }

  return normalized as T;
}

export function computeFinancials(lineItems: LineItem[], vatRate: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price), 0);
  const total = subtotal + subtotal * vatRate;
  return { subtotal, total };
}

async function nextCrmSequence(sequenceKey: string) {
  const supabase = await createCrmServerClient();
  const { data, error } = await supabase.schema("crm").rpc("next_sequence", { p_sequence_key: sequenceKey });
  if (error) {
    throw error;
  }
  return Number(data);
}

export async function nextQuoteNumber() {
  return buildQuoteNumber(await nextCrmSequence("quote"));
}

export async function nextInvoiceNumber() {
  return buildInvoiceNumber(await nextCrmSequence("invoice"));
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
