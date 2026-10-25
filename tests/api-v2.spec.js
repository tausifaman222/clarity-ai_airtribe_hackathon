import { test, expect } from "@playwright/test";
import { SCENARIOS } from "../public/scenarios.js";

const interview = SCENARIOS.find(s => s.id === "job-interview");
const answer = "I'm Riya, a product analyst with three years at a fintech. When our onboarding drop-off hit 40 percent I led a redesign of the KYC flow and we cut drop-off to 22 percent in two months. I want this role because your team builds for first-time users, and I'd love to ask how you measure success in the first ninety days.";

test("agent team manifest is public", async ({ request }) => {
  const r = await (await request.get("/api/agents")).json();
  expect(r.agents.map(a => a.id)).toEqual(expect.arrayContaining(["scenario", "judge", "evaluator", "referee", "verifier", "planner", "presence"]));
});

test("scenario agent falls back to the closest template offline, and detects startup pitches", async ({ request }) => {
  const r = await (await request.post("/api/scenario", { data: { description: "I have a product manager job interview next week" } })).json();
  expect(r.offline).toBe(true);
  expect(r.scenario.name).toBe("Job interview");
  const p = await (await request.post("/api/scenario", { data: { description: "pitching my startup to angel investors for a seed round" } })).json();
  expect(p.kind).toBe("pitch");
  expect((await request.post("/api/scenario", { data: { description: "x" } })).status()).toBe(400);
});

test("custom scenario works through coach, judge, drill, follow-up and plan", async ({ request }) => {
  const base = { stage: "custom", scenario: interview, lang: "en-IN" };
  const coach = await (await request.post("/api/coach", { data: { ...base, userText: answer, history: [] } })).json();
  expect(coach.covered.every(id => interview.items.some(i => i.id === id))).toBe(true);
  expect(coach.covered).toContain("story");
  expect(coach.reply).not.toContain("undefined");

  const report = await (await request.post("/api/judge", { data: { ...base, transcript: answer, metrics: { durationSec: 40, presence: { sampledSec: 40, facePresentPct: 95, eyeContactPct: 62, posturePct: 80, handsVisiblePct: 30, gestureLevel: "natural", headSteadinessPct: 77, smilePct: 20 } } } })).json();
  expect(report.checklist.map(c => c.id)).toEqual(interview.items.map(i => i.id));
  expect(report.practiceLimitSec).toBe(240);
  expect(report.metrics.presence.score).toBeGreaterThan(0);
  expect(report.agentTrace.map(t => t.agent)).toEqual(expect.arrayContaining(["listener", "delivery", "presence", "verifier"]));
  expect(report.leaderboardStatus).toBeUndefined();

  const drill = await request.post("/api/drill", { data: { ...base, checklistId: "impact", transcript: answer } });
  expect(drill.status()).toBe(200);
  expect(["nailed", "close", "retry"]).toContain((await drill.json()).verdict);
  expect((await request.post("/api/drill", { data: { ...base, checklistId: "nope", transcript: answer } })).status()).toBe(400);

  const fu = await request.post("/api/followup", { data: { ...base, question: "Why should we hire you over others?", answer } });
  expect(fu.status()).toBe(200);
  expect((await fu.json()).score).toBeGreaterThanOrEqual(0);

  const plan = await (await request.post("/api/agent/plan", { data: { ...base, recent: [report] } })).json();
  expect(plan.plan.drills).toHaveLength(3);
  expect(plan.plan.drills.every(d => interview.items.some(i => i.id === d.checklistId))).toBe(true);
  expect(plan.trace.map(t => t.step)).toEqual(["gather", "analyse", "plan", "validate"]);
});

test("malformed custom scenarios are rejected", async ({ request }) => {
  const r = await request.post("/api/judge", { data: { stage: "custom", scenario: { name: "x", items: [] }, transcript: answer } });
  expect(r.status()).toBe(400);
});

test("voice routes say when they're not configured", async ({ request }) => {
  expect((await request.post("/api/tts", { data: { text: "hi" } })).status()).toBe(404);
  const stt = await request.post("/api/transcribe", { headers: { "content-type": "audio/webm" }, data: Buffer.alloc(2000) });
  expect(stt.status()).toBe(404);
  const deep = await (await request.get("/api/health?deep=1")).json();
  expect(deep.voice.provider).toBe("browser");
});

test("Google sign-in redirects honestly when it isn't configured", async ({ request }) => {
  const r = await request.get("/auth/google", { maxRedirects: 0 });
  expect(r.status()).toBe(302);
  expect(r.headers().location).toContain("/sign-in?error=google_unavailable");
});

test("privacy, terms and manifest pages are served", async ({ request }) => {
  for (const path of ["/privacy", "/terms", "/manifest.webmanifest"]) expect((await request.get(path)).status()).toBe(200);
});

test("MCP server: initialize, list tools and call them over JSON-RPC", async ({ request }) => {
  const rpc = async (method, params, id = 1) => (await request.post("/mcp", { data: { jsonrpc: "2.0", id, method, params } })).json();
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  expect(init.result.serverInfo.name).toBe("clarity-ai");
  expect((await request.post("/mcp", { data: { jsonrpc: "2.0", method: "notifications/initialized" } })).status()).toBe(202);
  const tools = await rpc("tools/list");
  expect(tools.result.tools.map(t => t.name)).toEqual(expect.arrayContaining(["design_scenario", "review_practice", "plan_practice"]));
  const list = await rpc("tools/call", { name: "list_scenarios", arguments: {} });
  expect(list.result.structuredContent.scenarios.length).toBeGreaterThanOrEqual(8);
  const review = await rpc("tools/call", { name: "review_practice", arguments: { stage: "seed", transcript: "Small Indian retailers lose sales when inventory runs out. Our software suggests reorder quantities. Twenty shops pay 2000 rupees monthly and eighteen renewed. We seek fifty lakh rupees." } });
  expect(review.result.isError).toBe(false);
  expect(review.result.structuredContent.overall).toBeGreaterThanOrEqual(0);
  expect((await rpc("nope")).error.code).toBe(-32601);
});
