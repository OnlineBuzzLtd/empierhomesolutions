"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function ApiActionButton({
  endpoint,
  method = "POST",
  label,
  className,
}: {
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE";
  label: string;
  className?: string;
}) {
  const demo = useCrmDemoMode();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(endpoint, { method });
    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: "Request failed." }));
      setError(result.error ?? "Request failed.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isSubmitting || demo.active}
        className={className}
      >
        {demo.active ? "Demo Mode Locked" : isSubmitting ? "Working..." : label}
      </button>
      <DemoReadonlyNotice />
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
