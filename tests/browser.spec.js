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
  await expect(page.getByText("Offline mode", { exact: true })).toBeVisible();
  await page.locator("#startBtn").click();
  await expect(page).toHaveURL(/#\/stage$/);
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.locator('[data-stage="seed"]').click();
  await expect(page.locator('[data-stage="seed"]')).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/#\/mode$/);
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
