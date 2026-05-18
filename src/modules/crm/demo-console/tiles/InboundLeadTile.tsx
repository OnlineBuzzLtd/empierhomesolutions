// Inbound-lead tile (ticket D-5). Display-only placeholders for the
// Google Lead Ads and Meta Lead Ads channels. The actual trigger lives
// in the operator panel (E-4) — these tiles exist so the prospect sees
// the full story (six channels) on the screen, even though only the
// operator can fire them from the laptop.
//
// One component, two instances (Google and Meta), distinguished by the
// `kind` prop.

type InboundLeadTileProps = {
  kind: "google" | "meta";
  // When E-4 lands, the operator can trigger from inside the panel and
  // the tile reflects "triggered Xs ago". For now isPending is always
  // false and the tile shows a prompt-the-operator message.
  isPending?: boolean;
};

const COPY = {
  google: {
    title: "Google Ads Lead",
    short: "Google",
    accent: "bg-amber-100 text-amber-700",
    description:
      "A real Google Lead Ads webhook (captured from prior live traffic) replays into the CRM and the AI follows up.",
  },
  meta: {
    title: "Meta Lead Ad",
    short: "Meta",
    accent: "bg-indigo-100 text-indigo-700",
    description:
      "A real Meta Lead Ad webhook replays into the CRM. Same agent-follow-up flow as Google.",
  },
} as const;

export function InboundLeadTile({ kind, isPending = false }: InboundLeadTileProps) {
  const copy = COPY[kind];

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{copy.title}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${copy.accent}`}
        >
          {copy.short}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
        <p className="text-xs text-slate-500">{copy.description}</p>
        {isPending ? (
          <p className="text-xs font-semibold text-blue-700">Triggered — watch the live pane.</p>
        ) : (
          <p className="text-xs font-semibold text-slate-600">
            Ask the operator to trigger this lead.
          </p>
        )}
      </div>
    </section>
  );
}
