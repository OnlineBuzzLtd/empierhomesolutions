import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { ChevronDown, House, PhoneCall } from "lucide-react";
import { businessDetails } from "@/lib/business";
import { publicEnv } from "@/lib/env";
import { SiteFooter } from "@/modules/lp/components/SiteFooter";
import { StickyCallBar } from "@/modules/lp/components/StickyCallBar";
import { AnalyticsTracker } from "@/modules/tracking/AnalyticsTracker";

const gtmInline = publicEnv.gtmId
  ? `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${publicEnv.gtmId}');`
  : "";

const ga4Inline = publicEnv.ga4Id
  ? `window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${publicEnv.ga4Id}',{send_page_view:false});`
  : "";

export default function LpLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {publicEnv.gtmId ? (
        <Script id="gtm-loader" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: gtmInline }} />
      ) : null}
      {publicEnv.ga4Id ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${publicEnv.ga4Id}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-loader"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: ga4Inline }}
          />
        </>
      ) : null}

      {publicEnv.gtmId ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${publicEnv.gtmId}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      ) : null}

      <main className="min-h-screen bg-[var(--ehs-surface)] pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3.5">
            <Link href="/lp/boiler-repair/uxbridge" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
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
                href="/lp/boiler-repair/uxbridge"
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
                <ChevronDown size={13} />
              </Link>
              <Link
                href="/lp/boiler-installation/uxbridge"
                className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
              >
                Boiler Installation
                <ChevronDown size={13} />
              </Link>
              <Link
                href="/lp/power-flushing/uxbridge"
                className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
              >
                Power Flushing
                <ChevronDown size={13} />
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
                <ChevronDown size={13} />
              </Link>
              <Link
                href="/q-and-a"
                className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
              >
                Q&amp;A
              </Link>
              <a
                href="#lead-form"
                className="inline-flex snap-start items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 hover:bg-white hover:text-[var(--ehs-brand-accent)]"
              >
                Book Now
              </a>
            </nav>
          </div>
        </header>
        {children}
        <SiteFooter />
      </main>
      <Suspense fallback={null}>
        <StickyCallBar />
      </Suspense>
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
    </>
  );
}
