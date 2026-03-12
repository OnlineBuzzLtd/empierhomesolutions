import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock3, House, PhoneCall, PoundSterling, ShieldCheck, Star } from "lucide-react";
import { businessDetails } from "@/lib/business";
import { SiteFooter } from "@/modules/lp/components/SiteFooter";

const coreServices = [
  {
    title: "Emergency Boiler Repair",
    description: "Rapid fault diagnosis and same-day repair for no heat, no hot water, leaks, and lockouts.",
    href: "/lp/boiler-repair/uxbridge",
  },
  {
    title: "Boiler Installation",
    description:
      "A-rated boiler upgrades with fixed quoting, clean installs, and warranty-backed workmanship.",
    href: "/lp/boiler-installation/uxbridge",
  },
  {
    title: "Power Flushing",
    description:
      "Improve heating circulation and radiator performance with targeted domestic system flushing.",
    href: "/lp/power-flushing/uxbridge",
  },
  {
    title: "Boiler Finance",
    description: "Flexible finance options to spread installation costs, subject to status and affordability checks.",
    href: "/finance",
  },
];

const trustPoints = [
  "Gas Safe registered engineers",
  `Gas Safe number ${businessDetails.gasSafeNumber}`,
  `VAT registration number ${businessDetails.vatRegistrationNumber}`,
  `Accredited installers of ${businessDetails.accreditedBrands.join(" and ")}`,
  "Happy to discuss all major boiler brands",
  "Transparent pricing before work starts",
  "Rated highly by local homeowners",
  "Installation warranties of up to 10 years",
  "24/7 emergency call out support",
];

const bannerItems = [
  {
    key: "gas-safe",
    label: `Gas Safe: ${businessDetails.gasSafeNumber}`,
    icon: <ShieldCheck size={15} className="text-emerald-600" />,
  },
  {
    key: "rating",
    label: `${businessDetails.googleRatingValue.toFixed(1)} (${businessDetails.googleReviewCount} reviews)`,
    icon: <Star size={15} className="fill-amber-400 text-amber-400" />,
  },
  {
    key: "diagnostic",
    label: "Fixed diagnostic from £79",
    icon: <PoundSterling size={15} className="text-[var(--ehs-brand-dark)]" />,
  },
  {
    key: "guarantee",
    label: "12-month workmanship guarantee",
    icon: <ShieldCheck size={15} className="text-[var(--ehs-brand-dark)]" />,
  },
  {
    key: "attendance",
    label: "Same-day attendance in core areas",
    icon: <Clock3 size={15} className="text-[var(--ehs-brand-dark)]" />,
  },
  {
    key: "emergency",
    label: "24/7 emergency call out",
    icon: <Clock3 size={15} className="text-white" />,
    emphasize: true,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--ehs-surface)]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Image
              src="/brands/ehs-logo-white.png"
              alt="Empire Home Solutions logo"
              width={50}
              height={50}
              className="h-10 w-10 rounded-md border border-slate-200 bg-white p-1 sm:h-12 sm:w-12"
              priority
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-bold text-[var(--ehs-brand-dark)] sm:text-sm md:text-base">
                Empire Home Solutions
              </p>
              <p className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:block">
                Heating and Gas Engineers
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href={`tel:${businessDetails.primaryPhoneRaw}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ehs-brand-dark)] px-3 py-2 text-xs font-semibold text-white sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm md:px-6 md:py-3 md:text-base"
            >
              <PhoneCall size={14} className="sm:h-4 sm:w-4" />
              <span className="md:hidden">Call</span>
              <span className="hidden md:inline">{businessDetails.primaryPhoneDisplay}</span>
            </a>
            <Link
              href="/lp/boiler-repair/uxbridge#lead-form"
              className="rounded-lg bg-[var(--ehs-brand-accent)] px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:py-2.5 sm:text-sm md:px-6 md:py-3 md:text-base"
            >
              Book
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-200 bg-[var(--ehs-panel)]">
          <nav className="no-scrollbar mx-auto flex w-full max-w-6xl snap-x snap-mandatory items-center gap-2 overflow-x-auto px-3 py-2 text-[13px] font-medium text-[var(--ehs-brand-dark)] sm:gap-3 sm:px-4">
            <Link
              href="/#services"
              className="inline-flex snap-start items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              <House size={14} />
              Home
            </Link>
            <Link
              href="/lp/boiler-repair/uxbridge"
              className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              Boiler Repair
            </Link>
            <Link
              href="/lp/boiler-installation/uxbridge"
              className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              Boiler Installation
            </Link>
            <Link
              href="/lp/power-flushing/uxbridge"
              className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              Power Flushing
            </Link>
            <Link
              href="/finance"
              className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              Finance
            </Link>
            <Link
              href="/areas-we-cover"
              className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              Areas We Cover
            </Link>
            <Link
              href="/about-trust"
              className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              About Us
            </Link>
            <a
              href="#contact"
              className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
            >
              Book Now
            </a>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="w-full px-0 py-0">
          <div className="overflow-hidden border-y border-slate-200 bg-white shadow-[var(--ehs-card-shadow)]">
            <div className="grid items-stretch gap-0 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-5 bg-[var(--ehs-panel)] p-4 sm:p-6 md:p-10">
                <p className="inline-flex rounded-full border border-[var(--ehs-brand-accent)]/40 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-dark)]">
                  Local Heating Specialists
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--ehs-brand-dark-strong)] md:text-6xl">
                  Reliable Boiler Repair and Installation Across West London and Surrounding Regions
                </h1>
                <p className="max-w-xl text-[15px] text-slate-700 md:text-xl">
                  Heating and Gas Engineers for urgent breakdowns, planned upgrades, domestic power flushing, and
                  trusted aftercare for homeowners and landlords.
                </p>
                <ul className="space-y-2 text-sm text-slate-700 md:text-[17px]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                    <span>Local engineer response with clear next steps</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                    <span>Available 24/7, 365 days a year</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                    <span>No hidden call-out charges</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ehs-brand-accent)]" />
                    <span>Guaranteed workmanship from a Gas Safe team</span>
                  </li>
                </ul>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                  <a
                    href={`tel:${businessDetails.primaryPhoneRaw}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:min-w-32 sm:w-auto sm:px-5 md:px-6 md:py-3.5 md:text-base"
                  >
                    <PhoneCall size={16} />
                    Call Now
                  </a>
                  <Link
                    href="/lp/boiler-repair/uxbridge#lead-form"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--ehs-brand-dark)] bg-[var(--ehs-brand-dark)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:w-auto sm:px-5 md:px-6 md:py-3.5 md:text-base"
                  >
                    Book Now
                  </Link>
                </div>
              </div>
              <div className="relative h-full min-h-[260px] sm:min-h-[320px] lg:min-h-[620px]">
                <Image
                  src="/images/main-hero-2026-02-25.jpg"
                  alt="EHS engineer carrying out a power flushing service"
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  priority
                  className="object-cover object-[52%_0%]"
                />
              </div>
            </div>
            <div className="h-5 w-full bg-[var(--ehs-brand-accent)] [clip-path:polygon(0_35%,100%_0,100%_100%,0_100%)]" />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[var(--ehs-surface-contrast)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--ehs-card-shadow)]">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {bannerItems.map((item) => (
                <p
                  key={item.key}
                  className={
                    item.emphasize
                      ? "inline-flex items-center gap-2 rounded-lg bg-[var(--ehs-brand-accent)] px-3 py-2 text-sm font-semibold text-white"
                      : "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--ehs-panel)] px-3 py-2 text-sm font-medium text-[var(--ehs-brand-dark)]"
                  }
                >
                  {item.icon}
                  {item.label}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="bg-white px-4 py-14">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="border-l-4 border-[var(--ehs-brand-accent)] pl-3 text-3xl font-semibold text-[var(--ehs-brand-dark)]">
            Core Services
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {coreServices.map((service) => (
              <article
                key={service.title}
                className="rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-5 shadow-[var(--ehs-card-shadow)]"
              >
                <h3 className="text-lg font-semibold text-[var(--ehs-brand-dark)]">{service.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{service.description}</p>
                <Link
                  href={service.href}
                  className="mt-4 inline-flex text-sm font-semibold text-[var(--ehs-brand-accent)] hover:opacity-80"
                >
                  Learn more
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="bg-[var(--ehs-surface-contrast)] px-4 py-14">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="border-l-4 border-[var(--ehs-brand-accent)] pl-3 text-3xl font-semibold text-[var(--ehs-brand-dark)]">
            Why Homeowners Choose Us
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {trustPoints.map((point) => (
              <p
                key={point}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-[var(--ehs-brand-dark)]"
              >
                {point}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-white px-4 py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-6 shadow-[var(--ehs-card-shadow)]">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--ehs-brand-dark)]">Need help now?</h2>
            <p className="mt-2 text-sm text-slate-700">
              Landline {businessDetails.primaryPhoneDisplay} | Mobile / WhatsApp{" "}
              {businessDetails.mobilePhoneDisplay}
            </p>
            <p className="text-sm text-slate-700">{businessDetails.email}</p>
            <p className="mt-1 text-xs text-slate-600">
              Gas Safe {businessDetails.gasSafeNumber} | VAT {businessDetails.vatRegistrationNumber}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`tel:${businessDetails.primaryPhoneRaw}`}
              className="rounded-lg bg-[var(--ehs-brand-accent)] px-5 py-3 text-sm font-semibold text-white"
            >
              Call Now
            </a>
            <Link
              href="/lp/boiler-installation/uxbridge"
              className="rounded-lg border border-[var(--ehs-brand-dark)] bg-[var(--ehs-brand-dark)] px-5 py-3 text-sm font-semibold text-white"
            >
              Book Now
            </Link>
            <a
              href={businessDetails.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-[var(--ehs-brand-dark)]"
            >
              Read Google Reviews
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
