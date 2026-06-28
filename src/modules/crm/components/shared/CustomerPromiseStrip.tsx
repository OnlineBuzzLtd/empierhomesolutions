import type { CustomerPromiseSummary } from "@/modules/crm/lib/customer-promise";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import type { UserProfile } from "@/modules/crm/types";

type PromiseEditContext = {
  customerId?: string | null;
  leadId?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
  users?: Array<Pick<UserProfile, "user_id" | "full_name" | "role">>;
  invalidatePaths?: string[];
};

export function CustomerPromiseStrip({
  promise,
  editContext,
}: {
  promise: CustomerPromiseSummary;
  editContext?: PromiseEditContext;
}) {
  const editable = Boolean(editContext);
  const endpoint = promise.id ? `/api/crm/promises/${promise.id}` : "/api/crm/promises";
  const method = promise.id ? "PATCH" : "POST";

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        promise.state === "overdue"
          ? "border-rose-200 bg-rose-50"
          : promise.state === "ready"
            ? "border-cyan-200 bg-cyan-50"
            : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{promise.title}</p>
          <p className="mt-1 text-sm text-slate-600">{promise.detail}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            promise.state === "overdue"
              ? "bg-rose-100 text-rose-800"
              : promise.state === "ready"
                ? "bg-cyan-100 text-cyan-800"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {promise.state === "unset" ? "Needs promise" : promise.state}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <span>
          <span className="font-semibold text-slate-800">Owner:</span> {promise.ownerLabel}
        </span>
        <span>
          <span className="font-semibold text-slate-800">Due:</span> {promise.dueLabel}
        </span>
        <span>
          <span className="font-semibold text-slate-800">Channel:</span> {promise.channelLabel}
        </span>
      </div>
      {editable ? (
        <details className="mt-3 rounded-lg border border-white/70 bg-white/60 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Edit promise</summary>
          <ApiForm
            endpoint={endpoint}
            method={method}
            submitLabel="Save promise"
            successMessage="Promise saved."
            invalidatePaths={editContext?.invalidatePaths ?? ["/api/crm/dashboard/summary"]}
            className="mt-3"
          >
            <input type="hidden" name="customer_id" value={editContext?.customerId ?? ""} />
            <input type="hidden" name="lead_id" value={editContext?.leadId ?? ""} />
            <input type="hidden" name="job_id" value={editContext?.jobId ?? ""} />
            <input type="hidden" name="quote_id" value={editContext?.quoteId ?? ""} />
            <input type="hidden" name="invoice_id" value={editContext?.invoiceId ?? ""} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Promise</span>
                <input
                  name="title"
                  defaultValue={promise.source === "explicit" ? promise.title : "Customer follow-up"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Due</span>
                <input
                  name="due_at"
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(promise.dueAt)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</span>
                <select
                  name="owner_user_id"
                  defaultValue={promise.ownerUserId ?? ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {(editContext?.users ?? []).map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Channel</span>
                <select
                  name="channel"
                  defaultValue={promise.channel ?? "phone"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="webchat">Web chat</option>
                  <option value="voice">Voice</option>
                  <option value="office">Office</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
                <select
                  name="promise_type"
                  defaultValue={promise.promiseType ?? "follow_up"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="callback">Callback</option>
                  <option value="appointment">Appointment</option>
                  <option value="quote">Quote</option>
                  <option value="invoice">Invoice</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="office_review">Office review</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <select
                  name="status"
                  defaultValue={promise.status ?? "open"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Detail</span>
                <textarea
                  name="detail"
                  defaultValue={promise.detail}
                  className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </ApiForm>
        </details>
      ) : null}
    </div>
  );
}

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}
