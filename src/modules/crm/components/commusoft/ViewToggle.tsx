"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUiPreference } from "@/app/actions/ui-preference";
import type { EngineerUiMode } from "@/app/actions/ui-preference";

export function ViewToggle({ current }: { current: EngineerUiMode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function toggle(value: EngineerUiMode) {
    await setUiPreference(value);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-700">Choose your view</p>

      <div className="space-y-3">
        <ViewOption
          id="commusoft"
          title="Field App (Commusoft-style)"
          description="Streamlined mobile-first view. Simple job cards, arrive/leave workflow, leave questions, diary."
          active={current === "commusoft"}
          onClick={() => toggle("commusoft")}
          disabled={isPending}
        />
        <ViewOption
          id="classic"
          title="Classic View"
          description="Full job detail with all sections: phases, hazards, checklists, certificates, expenses, and commercial."
          active={current === "classic"}
          onClick={() => toggle("classic")}
          disabled={isPending}
        />
      </div>

      {isPending ? (
        <p className="text-xs text-slate-400">Saving preference...</p>
      ) : null}
    </div>
  );
}

function ViewOption({
  id,
  title,
  description,
  active,
  onClick,
  disabled,
}: {
  id: string;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${
        active
          ? "border-blue-500 bg-blue-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      } disabled:cursor-default`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 ${
            active ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"
          }`}
        />
        <div>
          <p className={`text-sm font-semibold ${active ? "text-blue-700" : "text-slate-900"}`}>
            {title}
            {active ? (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Active
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
      </div>
    </button>
  );
}
