import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
};

export function Section({ title, subtitle, className, children }: SectionProps) {
  return (
    <section className={cn("mx-auto w-full max-w-6xl px-4 py-10 md:py-14", className)}>
      {(title || subtitle) && (
        <header className="mb-6 border-l-4 border-[var(--ehs-brand-accent)] pl-3 md:mb-8 md:pl-4">
          {title ? (
            <h2 className="text-2xl font-semibold text-[var(--ehs-brand-dark)] md:text-3xl">{title}</h2>
          ) : null}
          {subtitle ? <p className="mt-2 text-sm text-slate-600 md:text-base">{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
