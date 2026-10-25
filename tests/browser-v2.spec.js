import { test, expect } from "@playwright/test";

// A stand-in for MediaPipe that "sees" a person looking away, so the camera coach must nudge.
const FAKE_VISION = `
const face = () => { const lm = Array.from({length: 478}, () => ({x: .5, y: .5}));
  lm[234]={x:.4,y:.5}; lm[454]={x:.6,y:.5}; lm[1]={x:.7,y:.52}; lm[10]={x:.5,y:.35}; lm[152]={x:.5,y:.7};
  lm[33]={x:.43,y:.45}; lm[133]={x:.47,y:.45}; lm[362]={x:.53,y:.45}; lm[263]={x:.57,y:.45}; lm[468]={x:.45,y:.45}; lm[473]={x:.55,y:.45}; return lm; };
const pose = () => { const lm = Array.from({length: 33}, () => ({x:.5,y:.5,visibility:1}));
  lm[0]={x:.5,y:.35,visibility:1}; lm[11]={x:.62,y:.6,visibility:1}; lm[12]={x:.38,y:.6,visibility:1}; lm[15]={x:.6,y:.8,visibility:.9}; lm[16]={x:.4,y:.8,visibility:.9}; return lm; };
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const FaceLandmarker = { createFromOptions: async () => ({ detectForVideo: () => ({ faceLandmarks: [face()], faceBlendshapes: [{ categories: [] }] }) }) };
export const PoseLandmarker = { createFromOptions: async () => ({ detectForVideo: () => ({ landmarks: [pose()] }) }) };`;

test.use({ permissions: ["camera", "microphone"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

test("practise anything: template → editable scenario → live practice with camera coach → report", async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/**/vision_bundle.mjs", r => r.fulfill({ contentType: "text/javascript", body: FAKE_VISION }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "" }));
  await page.goto("/");
  await page.getByRole("button", { name: /Job interview/ }).click();
  await expect(page).toHaveURL(/#\/scenario$/);
  await expect(page.getByRole("heading", { name: "Job interview" })).toBeVisible();
  await page.getByPlaceholder("Add a point you want feedback on…").fill("Salary expectations");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(".scn-items li")).toHaveCount(7);
  await page.getByRole("button", { name: /Start the live practice/ }).click();
  await expect(page).toHaveURL(/#\/briefing$/);
  await expect(page.getByText("Take up to 4 minutes", { exact: false })).toBeVisible();
  await page.getByLabel(/Camera coach/).check();
  await page.getByRole("button", { name: /Begin interview/ }).click();
  await expect(page.locator(".meera-name").first()).toContainText("Ananya Rao");
  await expect(page.getByText("Camera coach is on", { exact: false })).toBeVisible({ timeout: 15000 });
  await page.locator("#typed").evaluate(d => { d.open = true; });
  await expect(page.locator("#submitTyped")).toBeEnabled({ timeout: 20000 });
  await expect(page.locator("#camNudge")).toContainText("Look at the camera", { timeout: 12000 });
  await page.waitForTimeout(2500); // a few seconds of practice so the body-language summary has enough frames
  await page.locator("#typedTx").fill("I'm Riya, a product analyst with three years at a fintech. When onboarding drop-off hit 40 percent I led a KYC redesign and cut it to 22 percent in two months. I want this role because you build for first-time users. What does success look like in ninety days?");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Your practice feedback" })).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".presence")).toContainText("Eye contact");
  await expect(page.getByText("Salary expectations").first()).toBeVisible();
  await expect(page.getByText("How this feedback was made")).toBeVisible();
  await expect(page.getByText("Leaderboards are for startup pitches only", { exact: false })).toBeVisible();

  // Agent plan → drill.
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.locator(".drill-card")).toHaveCount(3);
  await page.locator("[data-drill]").first().click();
  await expect(page).toHaveURL(/#\/drill$/);
  await page.locator("#dAnswer").fill("When our drop-off hit 40 percent I led the redesign and we cut it to 22 percent in two months, saving support time.");
  await page.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.locator("#dResult .pill")).toBeVisible();
});

test("camera coach failure never blocks the practice", async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/**", r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "" }));
  await page.goto("/");
  await page.getByRole("button", { name: /Speech or toast/ }).click();
  await page.getByRole("button", { name: /Start the live practice/ }).click();
  await page.getByLabel(/Camera coach/).check();
  await page.getByRole("button", { name: /Begin interview/ }).click();
  await expect(page.getByText("couldn't start on this device", { exact: false })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#submitTyped")).toBeEnabled({ timeout: 20000 });
});

test("language picker offers global languages", async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "" }));
  await page.goto("/");
  const options = await page.locator("#anyLang option").allTextContents();
  expect(options.length).toBeGreaterThanOrEqual(16);
  expect(options).toEqual(expect.arrayContaining(["Español", "हिंदी", "日本語"]));
});
