"use client";

import { useMemo, useState } from "react";
import { Section } from "@/modules/ui/Section";
import type { ProofCard } from "@/modules/lp/types";

type ProofCardsSectionProps = {
  cards: ProofCard[];
};

export function ProofCardsSection({ cards }: ProofCardsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleCards = useMemo(() => (expanded ? cards : cards.slice(0, 6)), [cards, expanded]);

  return (
    <Section title="Recent local jobs" subtitle="Proof from nearby postcodes and recent callouts.">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <article
            key={card.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--ehs-card-shadow)]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-accent)]">
              {card.postcode} • {card.serviceType}
            </p>
            <p className="mt-2 text-base font-semibold text-[var(--ehs-brand-dark)]">{card.outcome}</p>
            <p className="mt-1 text-sm text-slate-700">“{card.reviewSnippet}”</p>
            <p className="mt-2 text-xs text-slate-500">{card.date}</p>
          </article>
        ))}
      </div>
      {cards.length > 6 ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-4 rounded-lg border border-[var(--ehs-brand-dark)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ehs-brand-dark)] hover:bg-slate-50"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </Section>
  );
}
