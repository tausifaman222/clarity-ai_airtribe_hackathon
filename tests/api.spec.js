import { test, expect } from "@playwright/test";
import { pitch, history } from "./support/fixtures.js";
import { STAGES } from "../public/rubrics.js";

test("health is explicitly offline without provider keys", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    ok: true, ai: false, mode: "offline", model: null,
    problem: "No LLM_API_KEY set", tts: "browser", evaluator: false,
  });
});

for (const stage of STAGES) {
  test(`${stage.name}: coach, verdict and report preserve offline contracts`, async ({ request }) => {
    const coach = await request.post("/api/coach", { data: { stage: stage.id, userText: pitch, history: [] } });
    expect(coach.status()).toBe(200);
    const c = await coach.json();
    expect(c.offline).toBe(true);
    expect(c.reply).toEqual(expect.any(String));
    expect(c.reply.length).toBeGreaterThan(0);
    expect(Array.isArray(c.covered)).toBe(true);
    expect(c.covered.every(id => stage.items.some(item => item.id === id))).toBe(true);

    const verdict = await request.post("/api/verdict", { data: { stage: stage.id, history } });
    expect(verdict.status()).toBe(200);
    const v = await verdict.json();
    expect(v.offline).toBe(true);
    expect(v.headline.length).toBeGreaterThan(0);
    expect(Array.isArray(v.clear)).toBe(true);
    expect(Array.isArray(v.missing)).toBe(true);

    const report = await request.post("/api/judge", {
      data: { stage: stage.id, transcript: pitch, metrics: { typed: true, durationSec: 60 } },
    });
    expect(report.status()).toBe(200);
    const r = await report.json();
    expect(r.offline).toBe(true);
    expect(r.metrics.typed).toBe(true);
    expect(r.metrics.wordCount).toBe(pitch.split(/\s+/).length);
    expect(r.metrics.durationSec).toBe(60);
    expect(r.checklist.map(item => item.id)).toEqual(stage.items.map(item => item.id));
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
    expect(r.rewrite.length).toBeGreaterThan(0);
    for (const key of ["structure", "clarity", "substance", "delivery"]) {
      expect(r.scores[key].score).toBeGreaterThanOrEqual(0);
      expect(r.scores[key].score).toBeLessThanOrEqual(10);
    }
  });
}

test("verdict requires two user turns, not just two messages", async ({ request }) => {
  for (const turns of [[], history.slice(0, 1), history.slice(0, 2)]) {
    const response = await request.post("/api/verdict", { data: { stage: "seed", history: turns } });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("Talk through at least two turns first.");
  }
});

for (const endpoint of ["coach", "verdict", "judge"]) {
  test(`${endpoint} rejects invalid and missing stages`, async ({ request }) => {
    for (const stage of ["invalid-stage", undefined]) {
      const response = await request.post(`/api/${endpoint}`, { data: { stage, history, userText: pitch, transcript: pitch } });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toContain("Unknown stage.");
    }
  });
}

test("coach rejects empty text", async ({ request }) => {
  const response = await request.post("/api/coach", { data: { stage: "seed", userText: "   " } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBe("Say or type something first.");
});

test("judge rejects fewer than 20 words and accepts exactly 20", async ({ request }) => {
  for (const count of [0, 19, 20]) {
    const transcript = pitch.split(/\s+/).slice(0, count).join(" ");
    const response = await request.post("/api/judge", { data: { stage: "seed", transcript } });
    expect(response.status()).toBe(count < 20 ? 422 : 200);
    const data = await response.json();
    if (count < 20) expect(data.error).toBe("too_short");
    else expect(data.offline).toBe(true);
  }
});
