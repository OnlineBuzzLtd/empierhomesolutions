import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { lpSocialImage } from "@/modules/lp/social-image";

vi.mock("@/lib/env", () => ({
  publicEnv: { siteUrl: "https://www.empirehomesolutions.co.uk", abFlags: "" },
}));

describe("landing page social previews", () => {
  it("sets the social image on the homepage outside the landing-page layout", async () => {
    const { metadata } = await import("@/app/page");
    expect(metadata.openGraph?.images).toEqual([lpSocialImage]);
    expect(metadata.twitter?.images).toEqual([lpSocialImage]);
  });
  it("serves a real 1200 by 630 PNG matching the metadata", async () => {
    const image = await sharp(`public${lpSocialImage.url}`).metadata();
    expect(image).toMatchObject({ format: "png", width: lpSocialImage.width, height: lpSocialImage.height });
  });

  it("preserves the image on service pages that override Open Graph metadata", async () => {
    const { generateMetadata } = await import("@/app/(lp)/lp/[service]/[location]/page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ service: "boiler-repair", location: "uxbridge" }),
      searchParams: Promise.resolve({}),
    });
    expect(metadata.openGraph?.images).toEqual([lpSocialImage]);
  });
});
