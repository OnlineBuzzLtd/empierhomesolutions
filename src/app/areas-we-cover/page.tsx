import Link from "next/link";
import type { ServiceSlug } from "@/modules/lp/types";
import { AiChatBubble } from "@/modules/lp/components/AiChatBubble";
import { ChatToggleProvider } from "@/modules/lp/components/ChatToggleProvider";
import { SiteFooter } from "@/modules/lp/components/SiteFooter";
import { buildLpPath, locationGroups, normalizeLocationSlug } from "@/modules/lp/content/locationCatalog";

const campaignServices: { service: ServiceSlug; label: string }[] = [
  { service: "boiler-repair", label: "Boiler Repair" },
  { service: "boiler-installation", label: "Boiler Installation" },
  { service: "power-flushing", label: "Power Flushing" },
];

const displayColumns = [
  ["HA", "W"],
  ["WD", "UB"],
  ["SL", "TW"],
  ["HP", "GU"],
  ["KT"],
];

const locationGroupMap = new Map(locationGroups.map((group) => [group.postcodeArea, group.locations]));

export default function AreasWeCoverPage() {
  return (
    <ChatToggleProvider>
      <main className="min-h-screen bg-[var(--ehs-surface)]">
      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--ehs-card-shadow)] md:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-accent)]">
              Location Coverage
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--ehs-brand-dark)] md:text-4xl">
              Areas We Cover
            </h1>
            <div className="mt-4">
              <Link
                href="/"
                className="inline-flex items-center rounded-md border border-[var(--ehs-brand-dark)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--ehs-brand-dark)] hover:bg-[var(--ehs-panel)]"
              >
                Back to Main Site
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--ehs-brand-dark)] p-5 text-white shadow-[var(--ehs-card-shadow)] md:p-10">
            <p className="text-center text-base md:text-2xl">
              EHS are based in West London, our team are available in the following locations and postcodes
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-3 xl:grid-cols-5">
              {displayColumns.map((column) => (
                <div key={column.join("-")} className="space-y-5">
                  {column.map((postcodeArea) => (
                    <div key={postcodeArea}>
                      <p className="text-2xl font-medium underline underline-offset-4">{postcodeArea}</p>
                      <ul className="mt-2 space-y-1.5 text-[20px] leading-snug">
                        {(locationGroupMap.get(postcodeArea) ?? []).map((location) => (
                          <li key={`${postcodeArea}-${location}`}>• {location}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--ehs-card-shadow)] md:p-8">
            <div className="space-y-6">
              {locationGroups.map((group) => (
                <section key={group.postcodeArea}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {group.postcodeArea}
                  </h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.locations.map((location) => {
                      const slug = normalizeLocationSlug(location);

                      return (
                        <article
                          key={`${group.postcodeArea}-${slug}`}
                          className="rounded-lg border border-slate-200 bg-[var(--ehs-surface-contrast)] p-3"
                        >
                          <p className="text-sm font-semibold text-[var(--ehs-brand-dark)]">{location}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{slug}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {campaignServices.map((item) => (
                              <Link
                                key={`${slug}-${item.service}`}
                                href={buildLpPath(item.service, slug)}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--ehs-brand-dark)] hover:border-[var(--ehs-brand-accent)] hover:text-[var(--ehs-brand-accent)]"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      </section>
      <SiteFooter />
      </main>
      <AiChatBubble />
    </ChatToggleProvider>
  );
}
