import { headers } from "next/headers";

export const BARK_PROFILE_URL = "https://www.bark.com/en/gb/company/empire-home-solutions-ehs/Bz62aw/";
export const BARK_WIDGET_SCRIPT_URL =
  "https://www.bark.com/assets/js/frontend-v2/widgets-v2.8a39154d87c1c90dcfd6148989a24ec0.v2.js";

/**
 * Bark's "pro" badge, using the exact embed markup Bark sent EHS on
 * 21 Oct 2026. Bark's script swaps the link for the badge image; if it fails
 * to load, the plain link to the Bark profile still shows.
 */
export async function BarkBadge() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <a
        href={BARK_PROFILE_URL}
        target="_blank"
        rel="noopener"
        className="bark-widget text-sm font-semibold text-[var(--ehs-brand-dark)] underline"
        data-type="pro"
        data-id="Bz62aw"
        data-image="medium-navy"
        data-version="3.0"
      >
        Empire Home Solutions (EHS)
      </a>
      {/*
        Bark's widget only initialises on DOMContentLoaded, so it must be a
        parser-inserted `defer` script (as in Bark's own snippet) - next/script
        loads after that event and the badge would never render. After a
        client-side navigation the script won't re-run; the plain link remains.
      */}
      <script src={BARK_WIDGET_SCRIPT_URL} defer nonce={nonce} />
    </>
  );
}
