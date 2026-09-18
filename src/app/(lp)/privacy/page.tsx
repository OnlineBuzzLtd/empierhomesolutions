import type { Metadata } from "next";
import { businessDetails } from "@/lib/business";
import { Section } from "@/modules/ui/Section";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Empire Home Solutions handles personal information on this website.",
};

export default function PrivacyPage() {
  return (
    <Section className="pt-10" title="Privacy notice" subtitle="Effective 24 August 2026">
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 shadow-[var(--ehs-card-shadow)] md:p-8">
        <p>
          Empire Home Solutions uses the information you submit to answer enquiries, arrange visits,
          provide quotations, deliver services, and keep appropriate business records. This may include
          your name, phone number, email address, address or postcode, and details of the work requested.
        </p>
        <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Website forms and webchat</h2>
        <p>
          Contact details entered in webchat are sent securely to our customer-journey system when you
          start a conversation. We do not save those contact details in your browser. The browser keeps
          only an anonymous visitor identifier used to operate the chat. Please do not send payment-card
          details, passwords, or other unnecessary sensitive information in chat.
        </p>
        <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Google Reviews</h2>
        <p>
          When enabled, our reviews feature retrieves current business rating and review information from
          Google Maps for the page you are viewing. Review content is not stored by this website. Reviewer
          names, review text, dates, ratings, and links are displayed with Google Maps attribution and are
          subject to the <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
        </p>
        <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Your choices</h2>
        <p>
          You may ask us to correct or delete information, restrict its use, or provide a copy where the
          law gives you that right. We retain information only as long as needed for the purposes above,
          legal obligations, and legitimate business records.
        </p>
        <p>
          For privacy questions, contact <a className="underline" href={`mailto:${businessDetails.email}`}>{businessDetails.email}</a> or call {businessDetails.primaryPhoneDisplay}.
        </p>
      </div>
    </Section>
  );
}
