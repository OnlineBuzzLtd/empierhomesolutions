import type { StatusBadgeConfig } from "@/modules/crm/types";

export function StatusBadge({ config }: { config: StatusBadgeConfig }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}>{config.label}</span>;
}
