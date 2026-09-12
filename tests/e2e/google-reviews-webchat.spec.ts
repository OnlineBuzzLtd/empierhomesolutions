import { expect, test, type Page } from "@playwright/test";

const reviewsPayload = {
  live: true,
  rating: 4.9,
  reviewCount: 127,
  googleMapsUri: "https://maps.google.com/?cid=123",
  reviewsUri: "https://maps.google.com/reviews?cid=123",
  reviews: Array.from({ length: 5 }, (_, index) => ({
    id: `places/review-${index + 1}`,
    authorName: `Customer ${index + 1}`,
    authorUri: `https://www.google.com/maps/contrib/${index + 1}`,
    authorPhotoUri: null,
    rating: 5,
    relativePublishTime: `${index + 1} days ago`,
    publishTime: `2026-08-${20 - index}T10:00:00.000Z`,
    text: `Helpful review number ${index + 1}`,
    googleMapsUri: `https://www.google.com/maps/reviews/${index + 1}`,
    flagContentUri: `https://www.google.com/maps/reviews/${index + 1}/report`,
  })),
};

async function mockReviews(page: Page, payload = reviewsPayload) {
  let requests = 0;
  await page.route("**/api/public/google-reviews", async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  return () => requests;
}

async function openChat(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Chat with/ }).click();
  await expect(page.getByRole("dialog", { name: /Chat with/ })).toBeVisible();
}

test.describe("live Google Reviews", () => {
  test("renders one accessible carousel, Google links, and keyboard controls", async ({ page }) => {
    const requestCount = await mockReviews(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Google Reviews" })).toBeVisible();
    await expect(page.getByText("4.9 from 127 reviews")).toBeVisible();
    await expect(page.getByText("Review 1 of 5")).toBeVisible();
    await expect(page.getByRole("group", { name: /1 of 5: Review by Customer 1/ })).toHaveAttribute("aria-hidden", "false");
    await expect(page.getByRole("link", { name: /Read all reviews/ })).toHaveAttribute("href", reviewsPayload.reviewsUri);
    await expect(page.getByRole("link", { name: /Read this review on Google Maps/ })).toHaveAttribute(
      "href",
      reviewsPayload.reviews[0]!.googleMapsUri,
    );

    const next = page.getByRole("button", { name: "Next review" });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Review 2 of 5")).toBeVisible();
    await expect(page.locator('article[aria-label^="1 of 5: Review by Customer 1"]')).toHaveAttribute("aria-hidden", "true");
    expect(requestCount()).toBe(1);
  });

  for (const path of [
    "/lp/boiler-repair/uxbridge",
    "/lp/boiler-installation/uxbridge",
    "/lp/power-flushing/uxbridge",
  ]) {
    test(`shows the review feature on ${path}`, async ({ page }) => {
      await mockReviews(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Google Reviews" })).toBeVisible();
      await expect(page.getByText("Review 1 of 5")).toBeVisible();
    });
  }

  test("shows the static fallback when review cards are unavailable", async ({ page }) => {
    await mockReviews(page, {
      ...reviewsPayload,
      live: false,
      rating: 4.8,
      reviewCount: 100,
      reviews: [],
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Visit Google Maps to read our latest customer reviews.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Read all reviews/ })).toBeVisible();
  });

  test("disables motion and auto-advance for reduced-motion users", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockReviews(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const track = page.locator('[aria-roledescription="carousel"] .flex').first();
    await expect(track).not.toHaveClass(/transition-transform/);
    await page.waitForTimeout(6_200);
    await expect(page.getByText("Review 1 of 5")).toBeVisible();
  });
});

test.describe("webchat preflight and ending", () => {
  test("requires contact details, forwards the real question, and does not persist PII", async ({ page }) => {
    let sessionPayload: Record<string, unknown> | null = null;
    await page.route("**/api/public/webchat/sessions", async (route) => {
      sessionPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          session: {
            conversation: { id: "33333333-3333-4333-8333-333333333333" },
            messages: [{
              id: "message-1",
              direction: "inbound",
              body: sessionPayload.openingMessage,
              createdAt: "2026-08-24T10:00:00.000Z",
            }],
            replyMessage: {
              id: "message-2",
              direction: "outbound",
              body: "Thanks — I can help with that.",
              createdAt: "2026-08-24T10:00:01.000Z",
            },
            bookingState: { currentState: "checking_availability" },
          },
        }),
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);

    await page.getByRole("button", { name: "Start chat" }).click();
    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter a valid UK mobile number.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Tell us briefly how we can help.")).toBeVisible();

    await page.getByLabel("Full name").fill("  Jane Smith  ");
    await page.getByLabel("Mobile number").fill("07911 123 456");
    await page.getByLabel("Email").fill(" JANE@EXAMPLE.COM ");
    await page.getByLabel("How can we help?").fill("Can I book a boiler repair next Tuesday afternoon?");
    await page.getByRole("button", { name: "Start chat" }).click();
    await expect(page.getByText("Thanks — I can help with that.")).toBeVisible();

    expect(sessionPayload).toMatchObject({
      fullName: "Jane Smith",
      phone: "+447911123456",
      email: "jane@example.com",
      openingMessage: "Can I book a boiler repair next Tuesday afternoon?",
      startNewConversation: true,
    });
    const storage = await page.evaluate(() => Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index)!;
        return [key, localStorage.getItem(key)];
      }),
    ));
    const chatKeys = Object.keys(storage).filter((key) => key.startsWith("empire_chat_"));
    expect(chatKeys).toEqual(["empire_chat_visitor_id"]);
    expect(JSON.stringify(storage)).not.toContain("Jane");
    expect(JSON.stringify(storage)).not.toContain("jane@example.com");
    expect(JSON.stringify(storage)).not.toContain("07911");
  });

  test("End chat clears immediately while close is slow, then reload starts fresh", async ({ page }) => {
    let sessionNumber = 0;
    await page.route("**/api/public/webchat/sessions", async (route) => {
      sessionNumber += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          session: {
            conversation: { id: `33333333-3333-4333-8333-${String(sessionNumber).padStart(12, "0")}` },
            messages: [],
            replyMessage: {
              id: `reply-${sessionNumber}`,
              direction: "outbound",
              body: `Fresh reply ${sessionNumber}`,
              createdAt: "2026-08-24T10:00:01.000Z",
            },
            bookingState: null,
          },
        }),
      });
    });
    let releaseClose!: () => void;
    const closeGate = new Promise<void>((resolve) => { releaseClose = resolve; });
    await page.route("**/api/public/webchat/close", async (route) => {
      await closeGate;
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false }) });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);
    await page.getByLabel("Full name").fill("Jane Smith");
    await page.getByLabel("Mobile number").fill("07911123456");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("How can we help?").fill("Boiler repair please");
    await page.getByRole("button", { name: "Start chat" }).click();
    await expect(page.getByText("Fresh reply 1")).toBeVisible();

    await page.getByRole("button", { name: "End chat" }).click();
    await expect(page.getByRole("heading", { name: "Chat ended" })).toBeVisible({ timeout: 500 });
    await expect(page.getByText("Fresh reply 1")).toHaveCount(0);
    releaseClose();

    await page.reload({ waitUntil: "domcontentloaded" });
    await openChat(page);
    await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
    await expect(page.getByText("Fresh reply 1")).toHaveCount(0);
    expect(sessionNumber).toBe(1);
  });

  test("the header button hides the same in-memory chat instead of ending it", async ({ page }) => {
    await page.route("**/api/public/webchat/sessions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          session: {
            conversation: { id: "33333333-3333-4333-8333-333333333333" },
            messages: [],
            replyMessage: {
              id: "reply-1",
              direction: "outbound",
              body: "This transcript stays in memory.",
              createdAt: "2026-08-24T10:00:01.000Z",
            },
            bookingState: null,
          },
        }),
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openChat(page);
    await page.getByLabel("Full name").fill("Jane Smith");
    await page.getByLabel("Mobile number").fill("07911123456");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("How can we help?").fill("Boiler repair please");
    await page.getByRole("button", { name: "Start chat" }).click();
    await expect(page.getByText("This transcript stays in memory.")).toBeVisible();

    await page.getByRole("button", { name: "Hide chat" }).click();
    await page.getByRole("button", { name: /Chat with/ }).click();
    await expect(page.getByText("This transcript stays in memory.")).toBeVisible();
  });
});
