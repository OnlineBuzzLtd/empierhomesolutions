import type { ReactNode } from "react";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";

export function SectionCard({
  title,
  action,
  demoAnchor,
  children,
}: {
  title: string;
  action?: ReactNode;
  demoAnchor?: string;
  children: ReactNode;
}) {
  return (
    <DemoAnchor name={demoAnchor}>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
        {children}
      </section>
    </DemoAnchor>
  );
}
