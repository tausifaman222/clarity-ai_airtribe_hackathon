import { test, expect } from "@playwright/test";

test("contact page: human check, friendly errors, then WhatsApp opens with the message", async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "" }));
  let posts = 0;
  await page.route("**/api/contact", r => {
    if (r.request().method() === "GET") return r.fulfill({ json: { enabled: true, name: "Tausif", question: "What is 3 + 4?", token: "t", turnstileSiteKey: null } });
    posts++;
    const b = r.request().postDataJSON();
    if (b.answer !== "7") return r.fulfill({ status: 400, json: { error: "wrong_answer", message: "That answer isn't right. Please try again." } });
    return r.fulfill({ json: { url: "https://wa.me/910000000000?text=hi" } });
  });
  await page.route("https://wa.me/**", r => r.fulfill({ body: "whatsapp" }));
  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: "Message Tausif on WhatsApp" })).toBeVisible();
  await expect(page.getByText("Quick check: What is 3 + 4?")).toBeVisible();
  await page.getByLabel("Your name").fill("Priya Sharma");
  await page.getByLabel("What's it about?").fill("Feedback on the interview practice");
  await page.getByLabel(/Quick check/).fill("9");
  await page.getByRole("button", { name: "Continue to WhatsApp" }).click();
  await expect(page.locator("#contactFeedback")).toContainText("isn't right");
  await page.getByLabel(/Quick check/).fill("7");
  await page.getByRole("button", { name: "Continue to WhatsApp" }).click();
  await page.waitForURL(/wa\.me/);
  expect(posts).toBe(2);
});

test("footer links to the contact page and the makers' LinkedIn, never to a raw number", async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "" }));
  await page.goto("/");
  const footer = page.locator(".cr-footer");
  await expect(footer.getByRole("link", { name: /Contact us on WhatsApp/ })).toHaveAttribute("href", "/contact");
  await expect(footer.getByRole("link", { name: "Ashish Kumar" })).toHaveAttribute("href", /linkedin\.com\/in\/ashishkumar620/);
  await expect(footer.getByRole("link", { name: "Tausif" })).toHaveAttribute("href", /linkedin\.com\/in\/tausif222/);
  expect(await page.content()).not.toMatch(/wa\.me\/\d/);
});
