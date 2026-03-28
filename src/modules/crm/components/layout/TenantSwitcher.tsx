"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function TenantSwitcher({
  activeTenantId,
  options,
}: {
  activeTenantId: string;
  options: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(activeTenantId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextTenantId: string) {
    setTenantId(nextTenantId);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/crm/tenants/active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tenant_id: nextTenantId }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: "Failed to switch workspace." }));
        setError(result.error ?? "Failed to switch workspace.");
        setTenantId(activeTenantId);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="crm-tenant-switcher" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Workspace
      </label>
      <select
        id="crm-tenant-switcher"
        value={tenantId}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
