import { Bell, Droplets, Flame, Gauge, TriangleAlert, Wrench } from "lucide-react";
import { Section } from "@/modules/ui/Section";
import type { FaultListItem } from "@/modules/lp/types";

const iconMap = {
  bell: Bell,
  droplets: Droplets,
  flame: Flame,
  gauge: Gauge,
  "triangle-alert": TriangleAlert,
  wrench: Wrench,
} as const;

type FaultListSectionProps = {
  faults: FaultListItem[];
};

export function FaultListSection({ faults }: FaultListSectionProps) {
  if (!faults.length) {
    return null;
  }

  return (
    <Section
      title="Common boiler faults we fix"
      subtitle="Tell us what you are seeing and we will triage before dispatch."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {faults.map((fault) => {
          const Icon = iconMap[fault.icon as keyof typeof iconMap] ?? Wrench;
          return (
            <article
              key={fault.id}
              className="rounded-xl border border-slate-200 border-l-4 border-l-[var(--ehs-brand-accent)] bg-white p-4 shadow-[var(--ehs-card-shadow)]"
            >
              <p className="inline-flex items-center gap-2 text-base font-semibold text-[var(--ehs-brand-dark)]">
                <Icon size={16} className="text-[var(--ehs-brand-accent)]" />
                {fault.title}
              </p>
              <p className="mt-1 text-sm text-slate-700">{fault.description}</p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
