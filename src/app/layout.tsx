import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { publicEnv } from "@/lib/env";
import {
  buildGa4Inline,
  buildGoogleAdsInline,
  buildGtmInline,
} from "@/modules/tracking/analyticsScripts";

export const metadata: Metadata = {
  title: "Empire Home Solutions",
  description: "Landing pages for boiler repair, boiler installation, power flushing, finance, and trust.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const nonce = headerStore.get("x-nonce") ?? undefined;
  const gtmId = publicEnv.gtmId;
  const ga4Id = publicEnv.ga4Id;
  const googleAdsId = publicEnv.googleAdsId;

  return (
    <html lang="en">
      <body className="antialiased">
        {gtmId ? (
          <Script
            id="gtm-loader"
            strategy="afterInteractive"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: buildGtmInline(gtmId) }}
          />
        ) : null}
        {ga4Id ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
              nonce={nonce}
            />
            <Script
              id="ga4-loader"
              strategy="afterInteractive"
              nonce={nonce}
              dangerouslySetInnerHTML={{ __html: buildGa4Inline(ga4Id) }}
            />
          </>
        ) : null}
        {googleAdsId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
              strategy="afterInteractive"
              nonce={nonce}
            />
            <Script
              id="google-ads-loader"
              strategy="afterInteractive"
              nonce={nonce}
              dangerouslySetInnerHTML={{ __html: buildGoogleAdsInline(googleAdsId) }}
            />
          </>
        ) : null}
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        {children}
      </body>
    </html>
  );
}
