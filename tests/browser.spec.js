import { test, expect } from "@playwright/test";
import { pitch } from "./support/fixtures.js";

test("choose a stage, submit a typed pitch, and retain its report on reload", async ({ page, baseURL }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // No external fonts/services and no speech hardware or installed voices needed.
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === new URL(baseURL).origin) return route.continue();
    return route.abort();
  });
  await page.addInitScript(() => {
    for (const key of ["SpeechRecognition", "webkitSpeechRecognition", "speechSynthesis"]) {
      Object.defineProperty(window, key, { configurable: true, value: undefined });
    }
  });
  await page.goto("/");
  await expect(page.locator(".cr-offline-note .mode-pill")).toHaveText("Offline mode");
  await page.locator("#startBtn").click();
  await page.locator('[data-stage="seed"]').click();
  await expect(page.locator('[data-stage="seed"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Choose how to practice" }).click();
  await page.getByRole("button", { name: /2-minute investor pitch/ }).click();
  await page.getByRole("button", { name: "Confirm practice setup" }).click();
  await expect(page.locator(".cr-ready")).toContainText("your Seed idea, in English");
  await page.getByRole("button", { name: "Enter Showtime" }).click();
  await expect(page.getByRole("heading", { name: "Showtime: Seed pitch" })).toBeVisible();
  await page.getByRole("button", { name: "I'm ready, start" }).click();
  await expect(page.locator("#submitTyped")).toBeEnabled();
  await expect(page.locator("#mic")).toBeDisabled();
  await page.getByPlaceholder("Type your pitch here…").fill(pitch);
  const submitted = page.waitForResponse(response => response.url().endsWith("/api/judge") && response.request().method() === "POST");
  await page.locator("#submitTyped").click();
  const response = await submitted;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ stage: "seed", transcript: pitch, metrics: { typed: true } });
  const report = await response.json();
  expect(report.offline).toBe(true);
  await expect(page).toHaveURL(/#\/report$/);
  await expect(page.getByText(/Offline mode: this report uses simple keyword rules/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seed checklist" })).toBeVisible();
  await expect(page.getByText("Typed pitch, so pace isn't measured.")).toBeVisible();
  await expect(page.getByLabel(`Overall score ${report.overall} out of 100`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Seed checklist" })).toBeVisible();
  await expect(page.getByLabel(`Overall score ${report.overall} out of 100`)).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile setup keeps language and stage, supports keyboard choices, and opens coaching", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let paidRequests = 0;
  page.on("request", request => {
    if (/\/api\/(coach|judge|tts)$/.test(new URL(request.url()).pathname)) paidRequests++;
  });
  await page.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
  await page.addInitScript(() => {
    for (const key of ["SpeechRecognition", "webkitSpeechRecognition", "speechSynthesis"]) {
      Object.defineProperty(window, key, { configurable: true, value: undefined });
    }
  });
  await page.goto("/");
  await expect(page).toHaveTitle(/Clarity AI/);
  const start = page.getByRole("button", { name: "Practise a startup pitch" });
  const box = await start.boundingBox();
  expect(box.y + box.height).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "हिंदी", exact: true }).click();
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Where are you with your idea?" })).toBeFocused();
  await page.locator('[data-stage="preseed"]').click();
  await page.getByRole("button", { name: "Choose how to practice" }).click();
  await page.getByRole("button", { name: "Back to stage" }).click();
  await expect(page.locator('[data-stage="preseed"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close practice setup" }).click();
  await expect(start).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: "हिंदी", exact: true })).toHaveAttribute("aria-pressed", "true");
  await start.click();
  await expect(page.locator('[data-stage="preseed"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Choose how to practice" }).click();
  await page.getByRole("button", { name: "Confirm practice setup" }).click();
  await expect(page.locator(".cr-ready")).toContainText("A guided rehearsal for your Pre-seed idea, in हिंदी");
  await expect(page.locator(".cr-ready")).toContainText("You can speak or type");
  expect(paidRequests).toBe(0);
  await page.getByRole("button", { name: "Start coaching" }).click();
  await expect(page).toHaveURL(/#\/coach$/);
  await expect(page.getByRole("button", { name: "हिंदी (hi-IN)", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Type instead" })).toBeVisible();
});

test("legacy stage and mode links still work, and future scenarios are not dead-end actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".cr-future")).toContainText("not available yet");
  await expect(page.locator(".cr-future button, .cr-future a")).toHaveCount(0);
  await page.goto("/#/stage");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.locator('[data-stage="seriesa"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/#\/mode$/);
  await expect(page.getByRole("button", { name: "Start coaching" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter Showtime" })).toBeVisible();
  await page.getByRole("link", { name: "Clarity AI home" }).click();
  await expect(page.getByRole("heading", { name: /Speak confidently/ })).toBeVisible();
});
