"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

type Props = {
  userId: string;
  active: boolean;
};

export function UserStatusToggle({ userId, active }: Props) {
  const demo = useCrmDemoMode();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/crm/settings/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });

    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    if (!response.ok) {
      setError(result.error ?? "Failed to update status.");
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={isSubmitting || demo.active}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
          active
            ? "bg-rose-100 text-rose-800 hover:bg-rose-200"
            : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
        }`}
      >
        {isSubmitting ? "..." : active ? "Deactivate" : "Activate"}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
