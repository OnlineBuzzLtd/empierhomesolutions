/**
 * E2E for the public /q/[token] surface.
 *
 * The public preview page is server-rendered against Supabase. Playwright
 * cannot intercept the Next.js → Supabase REST call (page.route only sees
 * browser-side requests), so we cannot fake a "valid token" without a
 * real DB row. What we CAN verify here is the negative path: an invalid
 * or unknown token must produce a not-found page and never leak quote
 * data. The valid-token / accept / reject flows are covered by the
 * Supabase integration suite (tests/integration/public-quote-token.test.ts).
 */

import { expect, test } from "@playwright/test";

test.describe("Public quote preview — invalid token", () => {
  test("malformed token returns 404 (no leak)", async ({ page }) => {
    const response = await page.goto("/q/not-a-real-uuid");
    // Next.js notFound() returns 404
    expect(response?.status()).toBe(404);
    // No quote details should be on the page
    await expect(page.getByText(/QU-/)).toHaveCount(0);
  });

  test("well-formed but unknown token returns 404", async ({ page }) => {
    const response = await page.goto("/q/00000000-0000-4000-8000-000000000000");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/QU-/)).toHaveCount(0);
  });
});
