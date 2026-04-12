"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function PlatformConversationReviewActions({
  conversationId,
  currentStatus,
  assigneeUserId,
  assigneeName,
  currentUserId,
  currentUserName,
}: {
  conversationId: string;
  currentStatus: "open" | "in_progress";
  assigneeUserId: string | null;
  assigneeName: string | null;
  currentUserId: string;
  currentUserName: string;
}) {
  const router = useRouter();
  const demo = useCrmDemoMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownedByCurrentUser = assigneeUserId === currentUserId;

  async function updateReview(payload: {
    status: "open" | "in_progress";
    assignee_user_id: string | null;
    assignee_name: string | null;
  }) {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/platform/conversations/${conversationId}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    if (!response.ok) {
      setError(result.error ?? "Failed to update review owner.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
            currentStatus === "in_progress" ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-700"
          }`}
        >
          {currentStatus === "in_progress" ? "In Progress" : "Open"}
        </span>
        <p className="text-xs text-slate-500">
          {assigneeName ? `Owned by ${assigneeName}` : "Unassigned"}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            void updateReview({
              status: "in_progress",
              assignee_user_id: currentUserId,
              assignee_name: currentUserName,
            })
          }
          disabled={isSubmitting || demo.active}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {ownedByCurrentUser ? "Assigned to you" : "Take ownership"}
        </button>
        <button
          type="button"
          onClick={() =>
            void updateReview({
              status: "open",
              assignee_user_id: null,
              assignee_name: null,
            })
          }
          disabled={isSubmitting || demo.active || (currentStatus === "open" && assigneeUserId === null)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Release
        </button>
        <DemoReadonlyNotice />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}
