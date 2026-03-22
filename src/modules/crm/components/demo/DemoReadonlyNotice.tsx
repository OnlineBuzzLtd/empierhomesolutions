"use client";

import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

export function DemoReadonlyNotice({ className = "" }: { className?: string }) {
  const demo = useCrmDemoMode();
  if (!demo.active) {
    return null;
  }

  return (
    <p className={`text-sm font-medium text-amber-700 ${className}`.trim()}>
      Demo mode is read-only.
    </p>
  );
}
