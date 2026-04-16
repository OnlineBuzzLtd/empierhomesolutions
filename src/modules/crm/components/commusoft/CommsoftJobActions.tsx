"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaveQuestionsModal } from "@/modules/crm/components/commusoft/LeaveQuestionsModal";
import type { JobChecklist, JobStatus } from "@/modules/crm/types";

export function CommsoftJobActions({
  jobId,
  jobStatus,
  mandatoryChecklists,
}: {
  jobId: string;
  jobStatus: JobStatus;
  mandatoryChecklists: JobChecklist[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const endpoint = `/api/crm/jobs/${jobId}`;

  const isPreArrival = jobStatus === "booked" || jobStatus === "enquiry";
  const isOnSite = jobStatus === "in_progress";

  async function updateStatus(status: JobStatus) {
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Request failed.");
      setBusy(false);
      return;
    }
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="px-4 pt-3 pb-2 space-y-3">
        {error ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
            <p className="text-sm font-medium text-rose-700">{error}</p>
          </div>
        ) : null}

        {isPreArrival ? (
          <div className="grid grid-cols-3 gap-2">
            <ActionButton
              label="Arrive"
              icon={<ArriveIcon />}
              color="bg-[#5cb85c] hover:bg-[#4cae4c]"
              onClick={() => updateStatus("in_progress")}
              disabled={busy}
            />
            <ActionButton
              label="No access"
              icon={<NoAccessIcon />}
              color="bg-[#e07080] hover:bg-[#d06070]"
              onClick={() => updateStatus("no_access")}
              disabled={busy}
            />
            <ActionButton
              label="Abort"
              icon={<AbortIcon />}
              color="bg-[#c0392b] hover:bg-[#a93226]"
              onClick={() => updateStatus("aborted")}
              disabled={busy}
            />
          </div>
        ) : isOnSite ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="Leave"
                icon={<LeaveIcon />}
                color="bg-[#5cb85c] hover:bg-[#4cae4c]"
                onClick={() => setShowLeaveModal(true)}
                disabled={busy}
              />
              <ActionButton
                label="Abort"
                icon={<AbortIcon />}
                color="bg-[#c0392b] hover:bg-[#a93226]"
                onClick={() => updateStatus("aborted")}
                disabled={busy}
              />
            </div>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c6fa0] px-4 py-4 text-sm font-semibold text-white hover:bg-[#6c5f90] disabled:opacity-50"
              disabled={busy}
            >
              <ReportIcon />
              Fill in the job report
            </button>
          </>
        ) : null}
      </div>

      {showLeaveModal ? (
        <LeaveQuestionsModal
          jobId={jobId}
          mandatoryChecklists={mandatoryChecklists}
          onClose={() => setShowLeaveModal(false)}
        />
      ) : null}
    </>
  );
}

function ActionButton({
  label,
  icon,
  color,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${color}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ArriveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2C7.24 2 5 4.24 5 7c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
        fill="currentColor"
      />
    </svg>
  );
}

function NoAccessIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AbortIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M13 3h4v14h-4M9 14l5-4-5-4M14 10H4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 7h8M5 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 12l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
