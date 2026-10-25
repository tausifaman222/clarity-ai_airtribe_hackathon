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
  await page.getByRole("button", { name: "Review the interview plan" }).click();
  await expect(page.getByRole("heading", { name: "One practice path, from warm-up to interview" })).toBeVisible();
  await expect(page.locator(".cr-stage-checklist li").first()).toBeVisible();
  await page.getByRole("button", { name: "Start my warm-up" }).click();
  await expect(page).toHaveURL(/#\/coach$/);
  await expect(page.getByText("Your warm-up coach")).toBeVisible();
  await expect(page.locator(".ck-detail").first()).toBeVisible();
  await page.getByRole("button", { name: /Continue to interview/ }).click();
  await expect(page).toHaveURL(/#\/briefing$/);
  await expect(page.getByRole("heading", { name: "Your Seed interview" })).toBeVisible();
  await expect(page.locator(".ck-detail").first()).toBeVisible();
  await page.getByRole("button", { name: /Begin interview/ }).click();
  await expect(page).toHaveURL(/#\/showtime$/);
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
  await expect(page.getByRole("heading", { name: "Seed pitch checklist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What to improve, and how" })).toBeVisible();
  const gaps = report.checklist.filter(point => point.status !== "covered");
  await expect(page.locator("[data-gap]")).toHaveCount(gaps.length);
  for (const point of gaps) {
    await expect(page.locator(`[data-gap="${point.id}"]`)).toContainText("How to work on it");
    await expect(page.locator(`[data-gap="${point.id}"]`)).toContainText("Replace the [placeholders]");
  }
  await expect(page.getByText("Typed pitch, so pace isn't measured.")).toBeVisible();
  await expect(page.getByLabel(`Overall score ${report.overall} out of 100`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Seed pitch checklist" })).toBeVisible();
  await expect(page.locator("[data-gap]")).toHaveCount(gaps.length);
  await page.getByRole("heading", { name: "What to improve, and how" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/report-improvement-plan.png" });
  await expect(page.getByLabel(`Overall score ${report.overall} out of 100`)).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile setup keeps language and stage, supports keyboard choices, and opens the warm-up", async ({ page, baseURL }) => {
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
  await page.getByRole("button", { name: "Review the interview plan" }).click();
  await expect(page.locator(".cr-stage-checklist li").first()).toBeVisible();
  await page.getByRole("button", { name: "Change stage" }).click();
  await expect(page.locator('[data-stage="preseed"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close practice setup" }).click();
  await expect(start).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: "हिंदी", exact: true })).toHaveAttribute("aria-pressed", "true");
  await start.click();
  await expect(page.locator('[data-stage="preseed"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Review the interview plan" }).click();
  await expect(page.locator(".cr-stage-checklist li").first()).toBeVisible();
  expect(paidRequests).toBe(0);
  await page.getByRole("button", { name: "Start my warm-up" }).click();
  await expect(page).toHaveURL(/#\/coach$/);
  await expect(page.getByRole("button", { name: /Continue to interview/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Practice language" })).toHaveValue("hi-IN");
  await expect(page.getByRole("textbox", { name: "Type instead" })).toBeVisible();
});

test("legacy stage and mode links open the unified interview flow without separate mode choices", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".cr-future")).toHaveCount(0);
  await expect(page.locator(".cr-template")).toHaveCount(9);
  await page.goto("/#/stage");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.locator('[data-stage="seriesa"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/#\/mode$/);
  await expect(page.getByRole("heading", { name: "Warm up, then meet your investor." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start warm-up", exact: true })).toBeVisible();
  await expect(page.getByText("Practise your full pitch", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Clarity AI home" }).click();
  await expect(page.getByRole("heading", { name: /Speak confidently/ })).toBeVisible();
});

async function prepareSavedPractice(page, baseURL, state) {
  await page.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
  await page.addInitScript(initial => {
    for (const key of ["SpeechRecognition", "webkitSpeechRecognition", "speechSynthesis"]) {
      Object.defineProperty(window, key, { configurable: true, value: undefined });
    }
    if (!sessionStorage.getItem("sayso.v1")) sessionStorage.setItem("sayso.v1", JSON.stringify(initial));
  }, state);
}

test("Stop freezes pitch time, reload restores its draft, Resume continues, Reset confirms", async ({ page, baseURL }) => {
  await prepareSavedPractice(page, baseURL, { stage: "seed", micLang: "en-IN", show: { stage: "seed", phase: "countdown" } });
  let submissions = 0;
  page.on("request", request => { if (request.url().endsWith("/api/judge")) submissions++; });
  await page.goto("/#/showtime");
  await expect(page.locator("#stopPractice")).toBeEnabled();
  await page.locator("#typedTx").fill("My saved draft should survive stopping and reloading.");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  const stopped = await page.locator("#timer").innerText();
  await page.waitForTimeout(1100);
  await expect(page.locator("#timer")).toHaveText(stopped);
  await expect(page.locator("#submitTyped")).toBeDisabled();
  await page.reload();
  await expect(page.locator("#timer")).toHaveText(stopped);
  await expect(page.locator("#typedTx")).toHaveValue("My saved draft should survive stopping and reloading.");
  await expect(page.locator("#resumePractice")).toBeEnabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator("#submitTyped")).toBeEnabled();
  await page.waitForTimeout(1100);
  expect(await page.locator("#timer").innerText()).not.toBe(stopped);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#typedTx")).not.toBeEmpty();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#timer")).toHaveText("5:00");
  await expect(page.locator("#timer")).toBeHidden();
  await expect(page.locator("#typedTx")).toBeEmpty();
  expect(submissions).toBe(0);
});

test("coaching Stop and Resume preserve a draft; Reset clears it only after confirmation", async ({ page, baseURL }) => {
  await prepareSavedPractice(page, baseURL, { stage: "seed", micLang: "en-IN" });
  await page.goto("/#/coach");
  await page.getByRole("textbox", { name: "Type instead" }).fill("Keep my unfinished idea.");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Type instead" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Type instead" })).toHaveValue("Keep my unfinished idea.");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Type instead" })).toBeEnabled();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Type instead" })).toHaveValue("Keep my unfinished idea.");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Type instead" })).toBeEmpty();
  await page.getByRole("link", { name: "Clarity AI home" }).click();
  await expect(page.getByRole("button", { name: "Resume practice" })).toBeVisible();
});

test("leaderboard filters show honest empty states and guest scores cannot be published", async ({ page, baseURL }) => {
  await prepareSavedPractice(page, baseURL, {});
  const filters = [];
  await page.route("**/api/leaderboard?*", route => {
    filters.push(new URL(route.request().url()).searchParams.toString());
    return route.fulfill({ json: { entries: [] } });
  });
  await page.goto("/#/leaderboard");
  await expect(page.getByRole("heading", { name: "No published scores yet." })).toBeVisible();
  await page.locator("#leaderStage").selectOption("seed");
  await page.getByRole("button", { name: "Typed pitches", exact: true }).click();
  await expect.poll(() => filters.at(-1)).toBe("stage=seed&input=typed");
  await expect(page.locator("#myScores")).toContainText("Publishing is optional");
  const response = await page.request.post("/api/leaderboard/publish", { headers: { "x-test-user": "pretend" }, data: { score: 100, displayName: "Forged" } });
  expect(response.status()).toBe(401);
});

test("Showtime countdown appears only at 45 seconds left and submits at five minutes", async ({ page, baseURL }) => {
  await page.clock.install({ time: new Date("2026-10-24T10:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-24T10:00:01Z"));
  await prepareSavedPractice(page, baseURL, {
    stage: "seed", micLang: "en-IN",
    show: { stage: "seed", phase: "paused", elapsedMs: 254000, typedDraft: pitch, segs: [] },
  });
  await page.goto("/#/showtime");
  await expect(page.locator("#timer")).toHaveText("0:46");
  await expect(page.locator("#timer")).toBeHidden();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.runFor(999);
  await expect(page.locator("#timer")).toBeHidden();
  await page.clock.runFor(1);
  await expect(page.locator("#timer")).toBeVisible();
  await expect(page.locator("#timer")).toHaveText("0:45");
  expect(await page.locator("#timer").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(16);
  await expect(page.locator("#timeNotice")).toContainText("45 seconds left");
  await page.screenshot({ path: "generated-artifacts/showtime-final-countdown.png" });
  const submission = page.waitForRequest(request => request.url().endsWith("/api/judge") && request.method() === "POST");
  await page.clock.runFor(45000);
  const request = await submission;
  expect(request.postDataJSON()).toMatchObject({ transcript: pitch, metrics: { durationSec: 300, typed: true } });
});

test("username sign-in screens explain the account model and keep guest practice available", async ({ page }) => {
  await page.goto("/");
  // This regression server has no database, so the header hides sign-in buttons instead of offering a dead end.
  const homeAccounts = page.locator(".cr-product-nav [data-auth-controls]");
  await expect(homeAccounts.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(homeAccounts.getByRole("link", { name: "Continue with Google" })).toHaveCount(0);

  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("minlength", "12");
  await expect(page.getByText("Google sign-in · Coming soon")).toHaveCount(0);
  await expect(page.getByText(/Password recovery isn't available yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Keep practising as a guest." })).toBeVisible();
  await page.getByRole("link", { name: /Sign in/ }).last().click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
});
