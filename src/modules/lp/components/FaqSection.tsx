"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Section } from "@/modules/ui/Section";
import type { FAQItem } from "@/modules/lp/types";
import { trackFaqExpand } from "@/modules/tracking/pushDataLayer";

type FaqSectionProps = {
  faqs: FAQItem[];
};

export function FaqSection({ faqs }: FaqSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Section title="FAQs" subtitle="Straight answers before you book.">
      <div className="space-y-2">
        {faqs.map((faq) => {
          const expanded = faq.id === openId;

          return (
            <article
              key={faq.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[var(--ehs-card-shadow)]"
            >
              <button
                type="button"
                aria-expanded={expanded}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--ehs-brand-dark)]"
                onClick={() => {
                  const nextOpen = expanded ? null : faq.id;
                  setOpenId(nextOpen);
                  if (nextOpen) {
                    trackFaqExpand(faq.id);
                  }
                }}
              >
                {faq.question}
                <ChevronDown
                  size={16}
                  className={
                    expanded
                      ? "rotate-180 text-[var(--ehs-brand-accent)] transition-transform"
                      : "text-[var(--ehs-brand-accent)] transition-transform"
                  }
                />
              </button>
              {expanded ? (
                <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {faq.answer}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </Section>
  );
}
