import { expect, test, type Page } from "@playwright/test";

async function waitForLeadForm(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#lead-form")).toBeVisible();
}

test.describe("LP critical path", () => {
  test("renders location-specific H1", async ({ page }) => {
    await page.goto("/lp/boiler-repair/uxbridge");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Uxbridge");
  });

  test("hero call CTA uses tel link", async ({ page }) => {
    await page.goto("/lp/boiler-repair/uxbridge");
    const callLink = page.getByRole("link", { name: "Call Now" }).first();
    await expect(callLink).toHaveAttribute("href", /tel:/);
  });

  test("form validation blocks empty submit", async ({ page }) => {
    await page.goto("/lp/boiler-repair/uxbridge");
    await waitForLeadForm(page);
    await page.getByRole("button", { name: "Book Now" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();
  });

  test("successful submit shows success state", async ({ page }) => {
    await page.goto("/lp/boiler-repair/uxbridge?utm_source=google&utm_campaign=repair-test");
    await waitForLeadForm(page);

    await page.getByRole("textbox", { name: "Name" }).fill("Jane Smith");
    await page.getByRole("textbox", { name: "Email (optional)" }).fill("jane@example.com");
    await page.getByRole("textbox", { name: "House name / number" }).fill("12");
    await page.getByRole("textbox", { name: "Street" }).fill("High Street");
    await page.getByRole("textbox", { name: "Postcode" }).fill("UB8 1AA");
    await page.getByRole("textbox", { name: "Phone" }).fill("07911123456");
    await page.getByRole("textbox", { name: "Issue" }).fill("Boiler has no heat and shows an error code.");
    await page.getByRole("button", { name: "Book Now" }).click();

    await expect(
      page.getByText("Thank you. Your request is in and our team will contact you shortly."),
    ).toBeVisible();
  });

  test("dataLayer receives form_success event", async ({ page }) => {
    await page.goto("/lp/boiler-repair/uxbridge");
    await waitForLeadForm(page);

    await page.getByRole("textbox", { name: "Name" }).fill("John Smith");
    await page.getByRole("textbox", { name: "House name / number" }).fill("12");
    await page.getByRole("textbox", { name: "Street" }).fill("High Street");
    await page.getByRole("textbox", { name: "Postcode" }).fill("UB8 1AA");
    await page.getByRole("textbox", { name: "Phone" }).fill("07911123456");
    await page
      .getByRole("textbox", { name: "Issue" })
      .fill("No hot water and pressure keeps dropping every day.");
    await page.getByRole("button", { name: "Book Now" }).click();

    await expect(
      page.getByText("Thank you. Your request is in and our team will contact you shortly."),
    ).toBeVisible();

    const hasSuccessEvent = await page.evaluate(() => {
      const events = (window as Window & { dataLayer?: Array<{ event?: string }> }).dataLayer ?? [];
      return events.some((entry) => entry.event === "form_success");
    });

    expect(hasSuccessEvent).toBe(true);
  });
});
