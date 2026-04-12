import { expect, test, type Page } from "@playwright/test";

async function openInbox(page: Page) {
  await page.goto("/inbox");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toContainText("Inbox", { timeout: 15000 });
}

test.describe("Front Desk smoke", () => {
  test("renders multiple front-desk scenarios in the real inbox UI", async ({ page }) => {
    await openInbox(page);

    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("One workspace queue for conversations, missed-call recovery, and linked CRM outcomes.")).toBeVisible();
    await expect(page.getByText("Missed call recovery").first()).toBeVisible();
    await expect(page.getByText("Urgent boiler repair enquiry.").first()).toBeVisible();
    await expect(page.getByText("Boiler service visit")).toBeVisible();
    await expect(page.getByText("Booked visit: Tue 11:00-12:00")).toBeVisible();
    await expect(page.getByText("Needs Review").first()).toBeVisible();
    await expect(page.getByText("Lead exists without a customer link").first()).toBeVisible();
  });

  test("allows an operator to take ownership of a review case", async ({ page }) => {
    let reviewPayload: Record<string, unknown> | null = null;

    await page.route("**/api/platform/conversations/*/review", async (route) => {
      reviewPayload = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, link: { id: "mock-link" } }),
      });
    });

    await openInbox(page);

    const reviewSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Needs Review Queue" }) });
    const reviewCard = reviewSection.locator("article").filter({ hasText: "Urgent boiler repair enquiry." }).first();
    await expect(reviewCard).toBeVisible();
    await reviewCard.getByRole("button", { name: "Take ownership" }).click();

    await expect.poll(() => reviewPayload).not.toBeNull();
    expect(reviewPayload).toMatchObject({
      status: "in_progress",
      assignee_name: "Alex Manager",
      assignee_user_id: "33333333-3333-4333-8333-333333333333",
    });
  });

  test("supports manual relink search and save from the inbox", async ({ page }) => {
    const searchRequests: string[] = [];
    let relinkPayload: Record<string, unknown> | null = null;

    await page.route("**/api/platform/relink/search?*", async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get("type");
      const q = url.searchParams.get("q") ?? "";
      searchRequests.push(`${type}:${q}`);

      if (type === "customer") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            customers: [
              {
                id: "70000000-0000-4000-8000-000000000001",
                full_name: "Jane Smith",
                phone: "07700900123",
                email: "jane@example.com",
                postcode: "UB8 1AA",
              },
            ],
            jobs: [],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          customers: [],
          jobs: [
            {
              id: "80000000-0000-4000-8000-000000000001",
              customer_id: "70000000-0000-4000-8000-000000000001",
              title: "Boiler service visit",
              status: "booked",
              scheduled_date: "2026-04-07",
            },
          ],
        }),
      });
    });

    await page.route("**/api/platform/conversations/*/relink", async (route) => {
      relinkPayload = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          link: {
            id: "mock-link",
            customer_id: "70000000-0000-4000-8000-000000000001",
            job_id: "80000000-0000-4000-8000-000000000001",
          },
        }),
      });
    });

    await openInbox(page);

    const reviewSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Needs Review Queue" }) });
    const relinkCard = reviewSection.locator("article").filter({ hasText: "Urgent boiler repair enquiry." }).first();
    await expect(relinkCard).toBeVisible();

    await relinkCard.getByText("Manual relink").click();
    await relinkCard.getByRole("textbox", { name: "Customer search" }).fill("Jane");
    await relinkCard.getByRole("button", { name: "Find" }).first().click();
    await relinkCard.getByRole("button", { name: /Jane Smith/ }).click();
    await expect(relinkCard.getByRole("textbox", { name: "Customer ID" })).toHaveValue("70000000-0000-4000-8000-000000000001");

    await relinkCard.getByRole("textbox", { name: "Job search" }).fill("Boiler");
    await relinkCard.getByRole("button", { name: "Find" }).nth(1).click();
    await relinkCard.getByRole("button", { name: /Boiler service visit/ }).click();
    await expect(relinkCard.getByRole("textbox", { name: "Job ID" })).toHaveValue("80000000-0000-4000-8000-000000000001");

    await relinkCard.getByRole("button", { name: "Save relink" }).click();

    await expect.poll(() => searchRequests).toEqual(["customer:Jane", "job:Boiler"]);
    await expect.poll(() => relinkPayload).not.toBeNull();
    expect(relinkPayload).toEqual({
      customer_id: "70000000-0000-4000-8000-000000000001",
      job_id: "80000000-0000-4000-8000-000000000001",
    });
  });
});
