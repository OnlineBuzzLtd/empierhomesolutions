import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import { createCustomerPromiseWithClient } from "@/modules/crm/lib/customer-promises";

type SnoozePreset = "later_today" | "tomorrow" | "in_2_days" | "next_week";

type LeadActionPayload =
  | { action: "claim" }
  | { action: "snooze"; preset?: SnoozePreset };

function isLeadActionPayload(value: unknown): value is LeadActionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.action === "claim") {
    return true;
  }
  if (record.action === "snooze") {
    return (
      record.preset === undefined ||
      record.preset === "later_today" ||
      record.preset === "tomorrow" ||
      record.preset === "in_2_days" ||
      record.preset === "next_week"
    );
  }
  return false;
}

function nextActionForPreset(preset: SnoozePreset = "later_today") {
  const due = new Date();
  if (preset === "tomorrow" || preset === "in_2_days" || preset === "next_week") {
    const dayOffset = preset === "tomorrow" ? 1 : preset === "in_2_days" ? 2 : 7;
    due.setUTCDate(due.getUTCDate() + dayOffset);
    due.setUTCHours(9, 0, 0, 0);
    return due.toISOString();
  }
  due.setUTCHours(due.getUTCHours() + 2);
  return due.toISOString();
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!isLeadActionPayload(body)) {
    return jsonError("Invalid lead action.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const patch =
    body.action === "claim"
      ? { assigned_to: auth.session.user.id }
      : {
          assigned_to: auth.session.user.id,
          next_action_at: nextActionForPreset(body.preset),
          status: "follow_up",
        };

  const { data, error } = await auth.session.supabase
    .schema("crm")
    .from("leads")
    .update(patch)
    .eq("id", id)
    .select("id, tenant_id, customer_id, assigned_to, next_action_at, status, problem_description, notes, source, is_demo, demo_scenario_key, customer:customers(id, phone, email)")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  if (body.action === "snooze" && data.next_action_at) {
    try {
      const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer;
      await createCustomerPromiseWithClient(auth.session.supabase, {
        tenant_id: auth.session.tenant.id,
        customer_id: data.customer_id,
        lead_id: data.id,
        promise_type: "callback",
        title: "Enquiry follow-up",
        detail: data.problem_description ?? data.notes ?? "Follow up this customer enquiry.",
        owner_user_id: data.assigned_to,
        due_at: data.next_action_at,
        channel: customer?.phone ? "phone" : customer?.email ? "email" : "office",
        status: "open",
        origin: "office",
        idempotency_key: `lead:${data.id}:next_action:${data.next_action_at}`,
        created_by: auth.session.user.id,
        updated_by: auth.session.user.id,
        is_demo: Boolean(data.is_demo),
        demo_scenario_key: data.demo_scenario_key ?? null,
      });
    } catch (promiseError) {
      const message = promiseError instanceof Error ? promiseError.message : "Promise could not be saved.";
      return jsonError(message, 500);
    }
  }

  return jsonSuccess({ lead: data });
}
