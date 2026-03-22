"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

type ApiFormProps = {
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE";
  submitLabel: string;
  className?: string;
  onSuccess?: () => void;
  successMessage?: string;
  children: ReactNode;
};

export function ApiForm({
  endpoint,
  method = "POST",
  submitLabel,
  className,
  onSuccess,
  successMessage = "Saved.",
  children,
}: ApiFormProps) {
  const demo = useCrmDemoMode();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key in payload) {
        const current = payload[key];
        payload[key] = Array.isArray(current) ? [...current, value] : [current, value];
        return;
      }
      payload[key] = value;
    });

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({ error: "Unexpected response." }));
    if (!response.ok) {
      setError(result.error ?? "Request failed.");
      setIsSubmitting(false);
      return;
    }

    setSuccess(successMessage);
    setIsSubmitting(false);
    onSuccess?.();
    router.refresh();
  }

  return (
    <form action={handleSubmit} className={className}>
      <fieldset disabled={isSubmitting || demo.active} className="space-y-3 disabled:opacity-60">
        {children}
      </fieldset>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || demo.active}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {demo.active ? "Demo Mode Locked" : isSubmitting ? "Saving..." : submitLabel}
        </button>
        <DemoReadonlyNotice />
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </form>
  );
}
