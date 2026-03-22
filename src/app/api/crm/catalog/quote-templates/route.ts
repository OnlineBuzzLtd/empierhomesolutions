import { parsePaymentTermsInput } from "@/modules/crm/lib/quote-templates";
import { quoteTemplateSchema } from "@/modules/crm/lib/validation";
import { jsonError, jsonSuccess, parseLineItems, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  let parsedPayload: unknown;
  try {
    parsedPayload = {
      ...body,
      line_items: parseLineItems(body.line_items ?? []),
      optional_extras: parseLineItems(body.optional_extras ?? []),
      payment_terms: parsePaymentTermsInput(body.payment_terms),
    };
  } catch {
    return jsonError("Template line items or payment terms must be valid JSON.");
  }

  const parsed = quoteTemplateSchema.safeParse(parsedPayload);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid quote template payload.");
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("quote_templates").upsert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ quoteTemplate: data });
}
