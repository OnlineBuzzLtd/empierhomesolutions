import { expect, test } from "@playwright/test";
import { businessDetails } from "../../src/lib/business";

const BARK_PROFILE_URL = "https://www.bark.com/en/gb/company/empire-home-solutions-ehs/Bz62aw/";

test.describe("Homepage: Phoenix finance banner and Bark badge", () => {
  test("shows the Phoenix banner linked to the finance calculator", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const banner = page.locator(`a[href="${businessDetails.finance.calculatorUrl}"]`).first();
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("target", "_blank");
    await expect(banner.getByRole("img", { name: "Phoenix finance banner" })).toBeVisible();

    // Phoenix permits only a simple phrase alongside the banner.
    await expect(page.getByText("Boiler Installation Finance available through Phoenix.")).toBeVisible();
  });

  test("keeps the Phoenix status disclosure in the homepage footer", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("footer").getByText(/Introducer Appointed Representative \(Financial Services Register No\. 1034368\)/),
    ).toBeVisible();
  });

  test("shows the Bark badge using Bark's embed markup", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const badge = page.locator(`a.bark-widget[href="${BARK_PROFILE_URL}"]`);
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveAttribute("data-id", "Bz62aw");
    await expect(badge).toHaveAttribute("data-type", "pro");
    await expect(badge).toHaveAttribute("data-image", "medium-navy");
    await expect(badge).toHaveAttribute("data-version", "3.0");
  });
});
