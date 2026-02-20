import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock3, Mail, MapPin, MessageCircle, PhoneCall, ShieldCheck } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { Section } from "@/modules/ui/Section";
import { loadAboutTrustContent } from "@/modules/lp/content/loadContent";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const content = loadAboutTrustContent();

  if (!content) {
    return { title: "About and trust", robots: { index: false, follow: false } };
  }

  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: {
      canonical: `${publicEnv.siteUrl}/about-trust`,
    },
  };
}

export default function AboutTrustPage() {
  const content = loadAboutTrustContent();

  if (!content) {
    notFound();
  }

  const landlineHref = `tel:${content.contactInfo.phone.replace(/\s+/g, "")}`;
  const mobileHref = `tel:${content.contactInfo.mobile.replace(/\s+/g, "")}`;

  return (
    <Section className="pt-10" title={content.title} subtitle={content.description}>
      <div className="space-y-5">
        <article className="rounded-2xl border border-[var(--ehs-brand-dark-strong)] bg-gradient-to-r from-[var(--ehs-brand-dark)] to-[var(--ehs-brand-dark-strong)] p-5 text-white shadow-[var(--ehs-card-shadow)] md:p-6">
          <h2 className="text-xl font-semibold md:text-2xl">Trusted local team for heating and gas work</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-100 md:text-base">{content.companyStory}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <ShieldCheck size={14} />
              Gas Safe {content.gasSafeNumber}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ehs-brand-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Clock3 size={14} />
              24/7 emergency call outs
            </span>
          </div>
        </article>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-5 shadow-[var(--ehs-card-shadow)]">
            <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Engineer credentials</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {content.engineerCredentials.map((credential) => (
                <li key={credential} className="flex items-start gap-2">
                  <BadgeCheck size={16} className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                  <span>{credential}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-dark)] bg-white p-5 shadow-[var(--ehs-card-shadow)]">
            <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Guarantees and proof</h2>
            <p className="mt-2 text-sm text-slate-700">{content.guaranteePolicy}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {content.reviewProof.map((proof) => (
                <li key={proof} className="flex items-start gap-2">
                  <BadgeCheck size={16} className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                  <span>{proof}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <article className="rounded-xl border border-[var(--ehs-brand-dark-strong)] bg-[var(--ehs-brand-dark)] p-5 text-white shadow-[var(--ehs-card-shadow)]">
          <h2 className="text-lg font-semibold">Safety and insurance</h2>
          <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm">
            <ShieldCheck size={16} />
            Gas Safe Registration Number: {content.gasSafeNumber}
          </p>
          <p className="mt-2 text-sm text-slate-100">{content.insuranceStatement}</p>
        </article>

        <article className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-5 shadow-[var(--ehs-card-shadow)]">
          <h2 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">Contact</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2 text-sm text-slate-700">
              <p className="flex items-center gap-2">
                <PhoneCall size={15} className="text-[var(--ehs-brand-accent)]" />
                Landline: {content.contactInfo.phone}
              </p>
              <p className="flex items-center gap-2">
                <MessageCircle size={15} className="text-[var(--ehs-brand-accent)]" />
                Mobile / WhatsApp: {content.contactInfo.mobile}
              </p>
              <p className="flex items-center gap-2">
                <Mail size={15} className="text-[var(--ehs-brand-accent)]" />
                Email: {content.contactInfo.email}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={15} className="text-[var(--ehs-brand-accent)]" />
                Area: {content.contactInfo.area}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-[var(--ehs-panel)] p-3">
              <p className="text-sm font-semibold text-[var(--ehs-brand-dark)]">Need help now?</p>
              <p className="mt-1 text-xs text-slate-600">Emergency call outs: 24/7</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={landlineHref}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ehs-brand-accent)] px-3 py-2 text-xs font-semibold text-white"
                >
                  <PhoneCall size={14} />
                  Call Now
                </a>
                <a
                  href={mobileHref}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ehs-brand-dark)] bg-[var(--ehs-brand-dark)] px-3 py-2 text-xs font-semibold text-white"
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </a>
                <Link
                  href="/lp/boiler-repair/uxbridge#lead-form"
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[var(--ehs-brand-dark)]"
                >
                  Book Now
                </Link>
              </div>
            </div>
          </div>
        </article>
      </div>
    </Section>
  );
}
