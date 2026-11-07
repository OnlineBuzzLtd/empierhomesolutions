import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequestOrigin } from "@/lib/origin";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import {
  getCustomerJourneysRuntimeLink,
  answerCustomerJourneysEducation,
} from "@/modules/crm/lib/customerjourneys";
import { EMPIRE_CRM_TENANT, ENQUIRY_FORM, isEmpireWebsiteHost } from "@/modules/education/policy";

const schema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) }).strict())
      .max(12)
      .default([]),
  })
  .strict();
const fallback = {
  mode: "education",
  answer: "I can’t check our information right now. Please use the enquiry form so the office can help.",
  sources: [],
  enquiryUrl: ENQUIRY_FORM,
  needsOfficeConfirmation: true,
};

export async function POST(request: Request) {
  if (!isEmpireWebsiteHost(new URL(request.url).host))
    return NextResponse.json({ error: "Not available for this website." }, { status: 404 });
  if (!validateRequestOrigin(request).ok)
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const limit = await consumeRateLimit(`education:${ip}`, {
    tokens: 15,
    window: "5 m",
    prefix: "rl:education",
  });
  const responseHeaders = { ...rateLimitHeaders(limit), "cache-control": "no-store" };
  if (!limit.ok) return NextResponse.json(fallback, { status: 429, headers: responseHeaders });
  const raw = await request.text();
  if (raw.length > 42000) return NextResponse.json({ error: "Message is too large." }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  try {
    const link = await getCustomerJourneysRuntimeLink(createCrmServiceRoleClient(), EMPIRE_CRM_TENANT);
    const answer = await answerCustomerJourneysEducation(link, parsed.data);
    return NextResponse.json(answer, { headers: responseHeaders });
  } catch {
    // Never create a legacy session or log customer messages on failure.
    return NextResponse.json(fallback, { status: 503, headers: responseHeaders });
  }
}
