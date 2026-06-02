"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeleteTrailPlan, DeleteTrailRootType } from "@/modules/crm/lib/delete-trail";

type DeleteTrailButtonProps = {
  rootType: DeleteTrailRootType;
  rootId: string;
  label?: string;
  compact?: boolean;
  onDeleted?: () => void;
};

async function postJson(endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({ error: "Unexpected response." }));
  if (!response.ok || !body.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Request failed.");
  }
  return body as Record<string, unknown>;
}

function CountGroup({ title, items }: { title: string; items: DeleteTrailPlan["will_delete"] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {items.map((item) => (
          <li key={`${item.table}-${item.label}`} className="flex items-center justify-between gap-3">
            <span>{item.label}</span>
            <span className="font-semibold text-slate-900">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeleteTrailButton({
  rootType,
  rootId,
  label = "Delete trail",
  compact = false,
  onDeleted,
}: DeleteTrailButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<DeleteTrailPlan | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  async function openPreview() {
    setOpen(true);
    setPlan(null);
    setError(null);
    setSuccess(null);
    setReason("");
    setConfirmation("");
    setLoading(true);
    try {
      const body = await postJson("/api/crm/deletion/preview", {
        root_type: rootType,
        root_id: rootId,
      });
      setPlan(body.plan as DeleteTrailPlan);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not preview deletion.");
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    if (!plan) return;
    setExecuting(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson("/api/crm/deletion/execute", {
        root_type: rootType,
        root_id: rootId,
        reason,
        plan_hash: plan.planHash,
        confirmation_phrase: confirmation,
      });
      setSuccess("Record trail deleted. Financial records were retained and redacted where required.");
      onDeleted?.();
      router.refresh();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Could not delete this trail.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        className={
          compact
            ? "rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            : "rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        }
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/40">
          <div className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Danger zone</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Delete record trail</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {loading ? <p className="text-sm text-slate-500">Checking connected CRM records...</p> : null}

              {plan ? (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{plan.root.label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Compliance-safe deletion keeps financial/audit rows and removes or redacts operational data.
                    </p>
                  </div>

                  {plan.blockers.length > 0 ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {plan.blockers[0]}
                    </div>
                  ) : null}

                  {plan.warnings.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {plan.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-4 rounded-lg border border-slate-200 p-4">
                    <CountGroup title="Will delete" items={plan.will_delete} />
                    <CountGroup title="Will anonymise" items={plan.will_anonymise} />
                    <CountGroup title="Will unlink" items={plan.will_unlink} />
                    <CountGroup title="Storage cleanup" items={plan.storage_cleanup} />
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reason
                    </span>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why this record trail is being deleted"
                      className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type {plan.confirmationPhrase}
                    </span>
                    <input
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={executing || plan.blockers.length > 0}
                    onClick={execute}
                    className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-slate-400"
                  >
                    {executing ? "Deleting..." : "Delete this record trail"}
                  </button>
                </>
              ) : null}

              {success ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {success}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
