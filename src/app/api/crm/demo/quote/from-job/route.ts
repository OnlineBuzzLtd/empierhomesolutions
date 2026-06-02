import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardDemoApi } from "@/modules/crm/demo-console/server/session-guard";
import { buildInvoiceNumber } from "@/modules/crm/lib/numbers";
import { draftQuoteForJob } from "@/modules/crm/lib/quote-automation";
import { invoiceKindForPaymentType } from "@/modules/crm/lib/invoicing";
import { buildInvoiceScheduleLineItem, calculateInvoiceScheduleAmount } from "@/modules/crm/lib/quotes";

const bodySchema = z.object({
  job_id: z.string().uuid().optional().nullable(),
  action: z.enum(["mark_survey_done_then_draft", "draft_from_service_booking", "generate_deposit_invoice"]),
});

function isRecentKillSwitch(value: string | null | undefined) {
  if (!value) return false;
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return true;
  return Date.now() - at < 24 * 60 * 60 * 1000;
}

async function nextInvoiceNumberForClient(admin: SupabaseClient) {
  const { data, error } = await admin.schema("crm").rpc("next_sequence", { p_sequence_key: "invoice" });
  if (error) throw error;
  return buildInvoiceNumber(Number(data));
}

export async function POST(request: Request) {
  const guard = await guardDemoApi({ requireActiveSession: true });
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid demo quote action." }, { status: 400 });
  }

  const { admin, tenantId, userId, activeSession } = guard;
  const { data: settings, error: settingsError } = await admin
    .schema("crm")
    .from("tenant_settings")
    .select("demo_kill_switch_at")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ demo_kill_switch_at: string | null }>();
  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }
  if (isRecentKillSwitch(settings?.demo_kill_switch_at)) {
    return NextResponse.json({ error: "Demo kill switch is active. Clear it before running quote actions." }, { status: 423 });
  }

  const jobQuery = admin
    .schema("crm")
    .from("jobs")
    .select("id, tenant_id, customer_id, title, visit_classification, is_test")
    .eq("tenant_id", tenantId)
    .eq("is_test", true)
    .gte("created_at", activeSession?.started_at ?? "1970-01-01T00:00:00.000Z");

  const { data: job, error: jobError } = parsed.data.job_id
    ? await jobQuery.eq("id", parsed.data.job_id).maybeSingle<{
        id: string;
        customer_id: string | null;
        title: string;
        visit_classification: string | null;
        is_test?: boolean | null;
      }>()
    : await jobQuery
        .gte("created_at", activeSession?.started_at ?? "1970-01-01T00:00:00.000Z")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          customer_id: string | null;
          title: string;
          visit_classification: string | null;
          is_test?: boolean | null;
        }>();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "No demo job found yet." }, { status: 404 });
  }

  try {
    if (parsed.data.action === "generate_deposit_invoice") {
      const { data: quote, error: quoteError } = await admin
        .schema("crm")
        .from("quotes")
        .select("id, job_id, customer_id, subtotal, vat_rate, vat_category, is_test")
        .eq("tenant_id", tenantId)
        .eq("job_id", job.id)
        .eq("is_test", true)
        .gte("created_at", activeSession?.started_at ?? "1970-01-01T00:00:00.000Z")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          job_id: string;
          customer_id: string;
          subtotal: number | string;
          vat_rate: number | string;
          vat_category: string;
          is_test?: boolean | null;
        }>();
      if (quoteError || !quote) {
        return NextResponse.json({ error: quoteError?.message ?? "Create a quote draft before generating a deposit invoice." }, { status: 404 });
      }

      const { data: schedule, error: scheduleError } = await admin
        .schema("crm")
        .from("invoice_schedules")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("quote_id", quote.id)
        .eq("is_test", true)
        .eq("payment_type", "deposit")
        .eq("status", "planned")
        .gte("created_at", activeSession?.started_at ?? "1970-01-01T00:00:00.000Z")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{
          id: string;
          label: string;
          payment_type: "deposit" | "stage" | "final";
          percentage: number | string | null;
          fixed_amount: number | string | null;
          due_offset_days: number | string | null;
          is_test?: boolean | null;
        }>();
      if (scheduleError || !schedule) {
        return NextResponse.json({ error: scheduleError?.message ?? "No planned deposit schedule found for this quote." }, { status: 404 });
      }

      const computed = calculateInvoiceScheduleAmount({
        subtotal: Number(quote.subtotal),
        vatRate: Number(quote.vat_rate),
        percentage: schedule.percentage === null ? null : Number(schedule.percentage),
        fixedAmount: schedule.fixed_amount === null ? null : Number(schedule.fixed_amount),
      });
      const lineItems = buildInvoiceScheduleLineItem({
        label: schedule.label,
        paymentType: schedule.payment_type,
        amount: computed.subtotal,
      });

      const { data: invoice, error: invoiceError } = await admin
        .schema("crm")
        .from("invoices")
        .insert({
          tenant_id: tenantId,
          quote_id: quote.id,
          job_id: quote.job_id,
          customer_id: quote.customer_id,
          invoice_number: await nextInvoiceNumberForClient(admin),
          invoice_kind: invoiceKindForPaymentType(schedule.payment_type),
          invoice_schedule_id: schedule.id,
          balance_of_quote_id: null,
          line_items: lineItems,
          subtotal: computed.subtotal,
          vat_rate: Number(quote.vat_rate),
          vat_category: quote.vat_category,
          total: computed.total,
          status: "unpaid",
          due_date: addDays(new Date(), Number(schedule.due_offset_days ?? 0)).toISOString().slice(0, 10),
          is_test: schedule.is_test === true || quote.is_test === true,
        })
        .select("*")
        .single();
      if (invoiceError) {
        return NextResponse.json({ error: invoiceError.message }, { status: 500 });
      }

      await admin
        .schema("crm")
        .from("invoice_schedules")
        .update({ invoice_id: invoice.id, status: "invoiced" })
        .eq("tenant_id", tenantId)
        .eq("id", schedule.id)
        .eq("is_test", true)
        .gte("created_at", activeSession?.started_at ?? "1970-01-01T00:00:00.000Z");
      await admin
        .schema("crm")
        .from("jobs")
        .update({ commercial_stage: "deposit_due" })
        .eq("tenant_id", tenantId)
        .eq("id", job.id)
        .eq("is_test", true)
        .gte("created_at", activeSession?.started_at ?? "1970-01-01T00:00:00.000Z");

      return NextResponse.json({ ok: true, job, invoice, action: parsed.data.action });
    }

    if (parsed.data.action === "mark_survey_done_then_draft") {
      const now = new Date().toISOString();
      const { error: surveyError } = await admin
        .schema("crm")
        .from("job_survey_assessments")
        .upsert(
          {
            tenant_id: tenantId,
            job_id: job.id,
            boiler_type: "Combi boiler",
            boiler_model: "Catalogue package selected",
            engineer_notes: "Demo survey completed by operator.",
            status: "completed",
            completed_at: now,
            created_by: userId,
            is_test: job.is_test === true,
          },
          { onConflict: "job_id" },
        );
      if (surveyError) {
        return NextResponse.json({ error: surveyError.message }, { status: 500 });
      }
      await admin
        .schema("crm")
        .from("jobs")
        .update({ commercial_stage: "survey_done" })
        .eq("tenant_id", tenantId)
        .eq("id", job.id)
        .eq("is_test", true)
        .gte("created_at", activeSession?.started_at ?? "1970-01-01T00:00:00.000Z");
    }

    const quoteAutomation = await draftQuoteForJob({
      supabase: admin,
      tenantId,
      jobId: job.id,
      actorId: userId,
      triggerSource: "demo_operator",
      force: true,
    });

    return NextResponse.json({ ok: true, job, quoteAutomation, action: parsed.data.action });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Demo quote action failed." },
      { status: 500 },
    );
  }
}
