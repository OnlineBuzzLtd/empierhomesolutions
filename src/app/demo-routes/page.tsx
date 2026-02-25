import Link from "next/link";
import Image from "next/image";
import { House, Link2 } from "lucide-react";

const demoPages = [
  { href: "/lp/boiler-repair/uxbridge", label: "Boiler Repair - Uxbridge" },
  { href: "/lp/boiler-repair/hayes", label: "Boiler Repair - Hayes" },
  { href: "/lp/boiler-installation/uxbridge", label: "Boiler Installation - Uxbridge" },
  { href: "/lp/boiler-installation/hayes", label: "Boiler Installation - Hayes" },
  { href: "/lp/power-flushing/uxbridge", label: "Power Flushing - Uxbridge" },
  { href: "/lp/power-flushing/hayes", label: "Power Flushing - Hayes" },
  { href: "/areas-we-cover", label: "Areas We Cover" },
  { href: "/finance", label: "Finance" },
  { href: "/about-trust", label: "About & Trust" },
];

export default function DemoRoutesPage() {
  return (
    <main className="min-h-screen bg-[var(--ehs-surface)] px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--ehs-card-shadow)]">
          <Image
            src="/brands/ehs-logo-white.png"
            alt="Empire Home Solutions logo"
            width={42}
            height={42}
            className="rounded-md border border-slate-200 bg-white p-1"
            priority
          />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--ehs-brand-dark)] md:text-3xl">
              Demo Routes
            </h1>
            <p className="text-sm text-slate-600">
              Review landing page variants and supporting trust/finance pages.
            </p>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {demoPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-[var(--ehs-brand-dark)] shadow-sm transition hover:border-[var(--ehs-brand-accent)] hover:text-[var(--ehs-brand-accent)]"
            >
              <Link2 size={15} />
              {page.label}
            </Link>
          ))}
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ehs-brand-dark)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
        >
          <House size={14} />
          Back to Main Home
        </Link>
      </div>
    </main>
  );
}
