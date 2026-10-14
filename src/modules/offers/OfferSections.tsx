import { CalendarCheck, Headset, MessageCircle, PoundSterling, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { businessDetails } from "@/lib/business";
import { OfferCallLink } from "@/modules/offers/OfferCallLink";
import { Section } from "@/modules/ui/Section";

const serviceIncludes = [
  { label: "Property protection", icon: ShieldCheck },
  { label: "Dedicated support staff", icon: Headset },
  { label: "Waste removal", icon: Trash2 },
  { label: "Clear, upfront pricing", icon: PoundSterling },
  { label: "Quality workmanship", icon: Wrench },
  { label: "Same or next day booking", icon: CalendarCheck },
];

const steps = [
  { title: "Claim your offer", body: "Call us or send the short form. It takes under a minute." },
  { title: "We confirm the price", body: "We call you back, agree a time and confirm the price before any work starts." },
  { title: "A Gas Safe engineer visits", body: "Our own engineer does the work, explains what they did and leaves your home tidy." },
];

export function HowItWorksSection() {
  return (
    <Section title="How it works" subtitle="Three simple steps, no surprises.">
      <ol className="grid gap-3 md:grid-cols-3 md:gap-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--ehs-card-shadow)] md:block md:p-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ehs-brand-accent)] text-sm font-bold text-white">
              {index + 1}
            </span>
            <div>
              <h3 className="text-base font-bold text-[var(--ehs-brand-dark)] md:mt-3">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function ServiceIncludesStrip() {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-500">All our services include</p>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          {serviceIncludes.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-2 text-sm font-semibold text-[var(--ehs-brand-dark)]">
              <Icon size={18} aria-hidden className="shrink-0 text-[var(--ehs-brand-accent)]" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function OfferCtaBand({ title = "Ready to book?" }: { title?: string }) {
  return (
    <section className="bg-[var(--ehs-brand-dark)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-300">
            Gas Safe registered ({businessDetails.gasSafeNumber}) and fully insured. Covering{" "}
            {businessDetails.coverageRegions.join(", ")}.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:shrink-0">
          <OfferCallLink className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90" />
          <a
            href={businessDetails.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[var(--ehs-brand-dark)] transition hover:opacity-90"
          >
            <MessageCircle size={16} aria-hidden />
            WhatsApp us
          </a>
        </div>
      </div>
    </section>
  );
}
