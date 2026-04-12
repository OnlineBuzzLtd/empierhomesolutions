import { expect, test } from "@playwright/test";

test.describe("Live channel tester", () => {
  test("shows all live channels with linked runtime readiness", async ({ page }) => {
    await page.goto("/ai-hub/live", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1, name: "Live Channel Tester" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { level: 3, name: "Web" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "SMS" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "WhatsApp" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Phone" })).toBeVisible();
    await expect(page.getByText("Empire Home Solutions Runtime")).toBeVisible();
    await expect(page.getByText("+44 1895 725151").first()).toBeVisible();
    await expect(page.getByText("Platform AI").first()).toBeVisible();
  });

  test("opens a linked webchat session and shows the agent reply", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/ai-hub/live", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Customer name").fill("Jane Smith");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("Opening message").fill("Need a boiler service this Thursday morning.");
    await page.getByRole("button", { name: "Start live webchat" }).click();

    await expect(page.getByText("Booking state: capturing_identity")).toBeVisible();
    await expect(page.getByLabel("Send message")).toBeVisible();

    await page.getByLabel("Send message").fill("UB8 1AA");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Booked for Thursday 10:00-11:00. We have your service visit locked in.")).toBeVisible();
    await expect(page.getByText("Lead booked · Booked visit: Thu 10:00-11:00")).toBeVisible();
    await expect(page.getByRole("link", { name: "Inbox" }).first()).toBeVisible();
  });
});
