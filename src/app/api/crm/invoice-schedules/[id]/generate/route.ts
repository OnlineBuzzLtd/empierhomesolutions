import { addDays } from "date-fns";
import { jsonError, jsonSuccess, nextInvoiceNumber, requireCrmApiUser } from "@/modules/crm/lib/api";
import { buildInvoiceScheduleLineItem, calculateInvoiceScheduleAmount } from "@/modules/crm/lib/quotes";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCrmApiUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { supabase } = auth.session;
    const { data: schedule, error: scheduleError } = await supabase
      .schema("crm")
      .from("invoice_schedules")
      .select("*, quote:quotes(*)")
      .eq("id", id)
      .single();
    if (scheduleError || !schedule || !schedule.quote) {
      return jsonError(scheduleError?.message ?? "Invoice schedule not found.", 404);
    }

    if (schedule.invoice_id) {
      return jsonError("Invoice has already been generated for this schedule.", 400);
    }

    const quote = schedule.quote as {
      id: string;
      job_id: string;
      customer_id: string;
      subtotal: number | string;
      vat_rate: number | string;
      vat_category: string;
    };

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

    const { data: invoice, error: invoiceError } = await supabase
      .schema("crm")
      .from("invoices")
      .insert({
        quote_id: quote.id,
        job_id: quote.job_id,
        customer_id: quote.customer_id,
        invoice_number: await nextInvoiceNumber(),
        line_items: lineItems,
        subtotal: computed.subtotal,
        vat_rate: Number(quote.vat_rate),
        vat_category: quote.vat_category,
        total: computed.total,
        status: "unpaid",
        due_date: addDays(new Date(), Number(schedule.due_offset_days ?? 14)).toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    if (invoiceError) {
      return jsonError(invoiceError.message, 500);
    }

    const { data: updatedSchedule, error: updateError } = await supabase
      .schema("crm")
      .from("invoice_schedules")
      .update({ invoice_id: invoice.id, status: "invoiced" })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    return jsonSuccess({ invoice, schedule: updatedSchedule });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to generate invoice.", 400);
  }
}
