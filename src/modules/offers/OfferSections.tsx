import { CalendarCheck, Headset, MessageCircle, PhoneCall, PoundSterling, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { businessDetails } from "@/lib/business";
import { Section } from "@/modules/ui/Section";

const serviceIncludes = [
  { label: "Property protection", icon: ShieldCheck },
  { label: "Dedicated support staff", icon: Headset },
  { label: "Waste removal", icon: Trash2 },
  { label: "Clear, upfront pricing", icon: PoundSterling },
  { label: "Quality workmanship", icon: Wrench },
  { label: "Same or next day booking", icon: CalendarCheck },
];

export function ServiceIncludesSection() {
  return (
    <Section title="All our services include" subtitle="Experienced engineers. Get it right first time.">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {serviceIncludes.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm font-semibold text-[var(--ehs-brand-dark)] shadow-[var(--ehs-card-shadow)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ehs-brand-accent-soft)]">
              <Icon size={20} aria-hidden className="text-[var(--ehs-brand-accent)]" />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function OfferContactBand() {
  return (
    <section className="bg-[var(--ehs-brand-dark)] text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1.2fr_1fr] md:items-center md:py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ehs-brand-accent-soft)]">
            Get a free quote today
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{businessDetails.primaryPhoneDisplay}</p>
          <p className="mt-2 text-sm text-slate-200">
            Gas Safe registered ({businessDetails.gasSafeNumber}) and fully insured. Covering{" "}
            {businessDetails.coverageRegions.join(", ")}.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={`tel:${businessDetails.primaryPhoneRaw}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <PhoneCall size={16} aria-hidden />
            Call now
          </a>
          <a
            href={businessDetails.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white px-4 py-3 text-sm font-semibold text-[var(--ehs-brand-dark)] transition hover:opacity-90"
          >
            <MessageCircle size={16} aria-hidden />
            Message us on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
