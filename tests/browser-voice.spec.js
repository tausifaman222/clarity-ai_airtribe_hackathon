import { test, expect } from "@playwright/test";

// A stand-in for kokoro-js: records what it was asked to say and returns a tiny WAV.
const FAKE_KOKORO = `
window.__kokoroSaid = [];
export const KokoroTTS = { from_pretrained: async (id, opts) => { window.__kokoroLoaded = { id, opts }; return {
  generate: async (text, { voice }) => { window.__kokoroSaid.push({ text, voice });
    return { toBlob: () => new Blob([new Uint8Array(44)], { type: "audio/wav" }) }; } }; } };`;

// Audio can't really play in headless tests: record plays and finish them quickly.
const STUB_PLAYBACK = () => {
  window.__played = [];
  HTMLMediaElement.prototype.play = function () { window.__played.push(this.src); setTimeout(() => this.onended?.(), 30); return Promise.resolve(); };
  window.__browserSaid = [];
  if (window.speechSynthesis) speechSynthesis.speak = u => { window.__browserSaid.push(u.text); setTimeout(() => u.onend?.(), 30); };
};

async function startPractice(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "" }));
  await page.goto("/");
  await page.getByRole("button", { name: /Speech or toast/ }).click();
  await page.getByRole("button", { name: /Start the live practice/ }).click();
  await page.getByRole("button", { name: /Begin/ }).click();
}

test("without ElevenLabs, the coach speaks with the free on-device Kokoro voice", async ({ page }) => {
  await page.addInitScript(STUB_PLAYBACK);
  await page.route("https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm", r => r.fulfill({ contentType: "text/javascript", body: FAKE_KOKORO }));
  await startPractice(page);
  await expect.poll(() => page.evaluate(() => window.__kokoroSaid?.length || 0), { timeout: 20000 }).toBeGreaterThan(0);
  const loaded = await page.evaluate(() => window.__kokoroLoaded);
  expect(loaded.id).toBe("onnx-community/Kokoro-82M-v1.0-ONNX");
  const said = await page.evaluate(() => window.__kokoroSaid);
  expect(said.every(s => ["af_heart", "am_michael"].includes(s.voice))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__played.filter(u => u.startsWith("blob:")).length)).toBeGreaterThan(0);
  await expect(page.locator("#submitTyped")).toBeEnabled({ timeout: 20000 });
});

test("if Kokoro can't load, the browser voice takes over and practice continues", async ({ page }) => {
  await page.addInitScript(STUB_PLAYBACK);
  await page.route("https://cdn.jsdelivr.net/**", r => r.abort());
  await startPractice(page);
  await expect.poll(() => page.evaluate(() => window.__browserSaid?.length || 0), { timeout: 20000 }).toBeGreaterThan(0);
  await expect(page.locator("#submitTyped")).toBeEnabled({ timeout: 20000 });
});

test("when ElevenLabs rejects the key, the app switches to Kokoro and stops retrying ElevenLabs", async ({ page }) => {
  await page.addInitScript(STUB_PLAYBACK);
  await page.route("https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm", r => r.fulfill({ contentType: "text/javascript", body: FAKE_KOKORO }));
  await page.route("**/api/health", async r => { const res = await r.fetch(); r.fulfill({ response: res, json: { ...(await res.json()), tts: "elevenlabs" } }); });
  let ttsCalls = 0;
  await page.route("**/api/tts", r => { ttsCalls++; r.fulfill({ status: 502, json: { error: "TTS unavailable" } }); });
  await startPractice(page);
  await expect.poll(() => page.evaluate(() => window.__kokoroSaid?.length || 0), { timeout: 25000 }).toBeGreaterThan(0);
  await expect(page.locator("#submitTyped")).toBeEnabled({ timeout: 20000 });
  expect(ttsCalls).toBeLessThanOrEqual(2); // the first failure (plus a prefetch at most), then no more ElevenLabs calls
});
