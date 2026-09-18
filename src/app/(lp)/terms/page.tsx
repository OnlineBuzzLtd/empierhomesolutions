import type { Metadata } from "next";
import { businessDetails } from "@/lib/business";
import { Section } from "@/modules/ui/Section";

export const metadata: Metadata = {
  title: "Website terms",
  description: "Terms for using the Empire Home Solutions website and webchat.",
};

export default function TermsPage() {
  return (
    <Section className="pt-10" title="Website terms" subtitle="Effective 24 August 2026">
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 shadow-[var(--ehs-card-shadow)] md:p-8">
        <p>
          This website provides general information about services offered by {businessDetails.name}.
          Website and webchat information is not a confirmed quotation, diagnosis, appointment, or
          guarantee of availability unless our team expressly confirms it with you.
        </p>
        <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Webchat</h2>
        <p>
          The chat assistant uses automated technology and can make mistakes. For a gas emergency,
          suspected carbon-monoxide issue, or immediate risk to people or property, leave the area when
          appropriate and contact the relevant emergency service or the National Gas Emergency Service.
          Do not rely on webchat for emergency safety instructions.
        </p>
        <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Google Maps content</h2>
        <p>
          Google ratings and reviews are supplied by Google and remain subject to the
          <a className="ml-1 underline" href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Google Maps/Google Earth Additional Terms</a> and
          <a className="ml-1 underline" href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google Terms of Service</a>.
          Google selects and orders the reviews shown for relevance. Review views do not represent an
          exhaustive or independently verified sample.
        </p>
        <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Contact</h2>
        <p>
          Questions about these terms can be sent to <a className="underline" href={`mailto:${businessDetails.email}`}>{businessDetails.email}</a>.
        </p>
      </div>
    </Section>
  );
}
