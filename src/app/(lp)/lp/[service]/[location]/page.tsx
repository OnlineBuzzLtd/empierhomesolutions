import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { getAbFlags } from "@/modules/lp/abFlags";
import { ALLOWED_SERVICES, loadLpContent, normalizeLocationSlug } from "@/modules/lp/content/loadContent";
import { InstallTemplate } from "@/modules/lp/templates/InstallTemplate";
import { RepairTemplate } from "@/modules/lp/templates/RepairTemplate";
import { buildLocalBusinessJsonLd } from "@/modules/seo/localBusinessJsonLd";
import { resolveCallNumber } from "@/modules/tracking/callNumber";

const demoLocations = ["uxbridge", "hayes"];
export const revalidate = 3600;

type RouteProps = {
  params: Promise<{
    service: string;
    location: string;
  }>;
  searchParams: Promise<{
    keyword?: string;
  }>;
};

function getCanonicalUrl(service: string, location: string) {
  return `${publicEnv.siteUrl}/lp/${service}/${location}`;
}

export async function generateStaticParams() {
  return ALLOWED_SERVICES.flatMap((service) =>
    demoLocations.map((location) => ({
      service,
      location,
    })),
  );
}

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const routeParams = await params;
  const routeSearchParams = await searchParams;
  const content = loadLpContent({
    service: routeParams.service,
    location: routeParams.location,
    keyword: routeSearchParams.keyword,
  });

  if (!content) {
    return {
      title: "Page not found",
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = getCanonicalUrl(content.service, normalizeLocationSlug(content.locationLabel));

  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: content.seo.title,
      description: content.seo.description,
      url: canonicalUrl,
      type: "website",
    },
  };
}

export default async function LpPage({ params, searchParams }: RouteProps) {
  const routeParams = await params;
  const routeSearchParams = await searchParams;

  const normalizedLocation = normalizeLocationSlug(routeParams.location);
  const content = loadLpContent({
    service: routeParams.service,
    location: normalizedLocation,
    keyword: routeSearchParams.keyword,
  });

  if (!content) {
    notFound();
  }

  const abFlags = getAbFlags();
  const callNumber = resolveCallNumber();

  if (abFlags.headline === "speed") {
    content.hero.headline = `Same-day ${content.serviceLabel.toLowerCase()} in ${content.locationLabel}`;
  }

  if (abFlags.cta === "speak-to-engineer") {
    content.cta.callLabel = "Speak to Engineer";
  }

  const jsonLd = buildLocalBusinessJsonLd(content, callNumber);

  if (content.service === "boiler-installation") {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <InstallTemplate content={content} trustOrder={abFlags.trustOrder} />
      </>
    );
  }

  if (content.service === "boiler-repair") {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <RepairTemplate content={content} trustOrder={abFlags.trustOrder} />
      </>
    );
  }

  notFound();
}
