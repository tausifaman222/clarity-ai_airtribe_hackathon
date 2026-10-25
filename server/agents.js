// Agentic practice loop:
//  1. Practice-plan agent: gathers your history (tool), analyses it (deterministic), plans your next drills (LLM),
//     then validates the plan against the stage rubric. Every step is recorded in a visible trace.
//  2. Drill coach: grades one focused 60–90 s rep on a single checklist point.
//  3. Investor follow-up: grades your answer to the toughest question from your report.
import { aiStatus, callLLMJson } from "../llm.js";
import { stageById, checklistText, STAGES } from "../public/rubrics.js";
import { trackFrom, ctxOf } from "./tracks.js";

const str = (v, max = 2000) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, max);
const arr = (v, max = 20) => (Array.isArray(v) ? v.slice(0, max) : []);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const DIMS = ["structure", "clarity", "substance", "delivery"];

// A compact, validated summary of one report (from the database or from the browser for guests).
function digest(r, stageId) {
  if (!r || typeof r !== "object") return null;
  return {
    stage: stageById(r.stage || stageId)?.id || stageId, overall: clamp(Math.round(num(r.overall)), 0, 100),
    at: str(r.at || r.created_at, 40),
    scores: Object.fromEntries(DIMS.map(k => [k, clamp(num(r.scores?.[k]?.score ?? r.scores?.[k]), 0, 10)])),
    gaps: arr(r.checklist, 20).filter(c => c?.status === "missing" || c?.status === "weak").map(c => ({ id: str(c.id, 40), status: c.status })),
    presence: r.metrics?.presence ? { score: num(r.metrics.presence.score), eyeContactPct: r.metrics.presence.eyeContactPct, posturePct: r.metrics.presence.posturePct } : null,
    fillers: num(r.metrics?.fillers?.total), wpm: num(r.metrics?.wpm), typed: !!r.metrics?.typed,
  };
}

// Deterministic analysis step: what keeps coming up, and is it getting better?
export function analyse(history, stage) {
  const gapsCount = {};
  for (const h of history) for (const g of h.gaps) if (stage.items.some(i => i.id === g.id)) gapsCount[g.id] = (gapsCount[g.id] || 0) + (g.status === "missing" ? 2 : 1);
  const avg = Object.fromEntries(DIMS.map(k => [k, history.length ? Math.round(history.reduce((a, h) => a + h.scores[k], 0) / history.length * 10) / 10 : null]));
  const weakestDim = DIMS.filter(k => avg[k] != null).sort((a, b) => avg[a] - avg[b])[0] || null;
  const ordered = [...history].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const trend = ordered.length >= 2 ? ordered[ordered.length - 1].overall - ordered[0].overall : null;
  const mustFirst = id => (stage.items.find(i => i.id === id)?.must ? 1 : 0);
  const topGaps = Object.entries(gapsCount).sort((a, b) => b[1] - a[1] || mustFirst(b[0]) - mustFirst(a[0])).map(([id]) => id).slice(0, 4);
  const presence = history.map(h => h.presence).filter(Boolean);
  return { attempts: history.length, best: Math.max(0, ...history.map(h => h.overall)), latest: ordered.at(-1)?.overall ?? null, trend, avg, weakestDim, topGaps,
    presenceAvg: presence.length ? Math.round(presence.reduce((a, p) => a + p.score, 0) / presence.length * 10) / 10 : null,
    fillersAvg: history.length ? Math.round(history.reduce((a, h) => a + h.fillers, 0) / history.length) : 0 };
}

function fallbackPlan(stage, a) {
  const ids = (a.topGaps.length ? a.topGaps : stage.items.filter(i => i.must).map(i => i.id)).slice(0, 3);
  while (ids.length < 3) { const extra = stage.items.find(i => !ids.includes(i.id)); if (!extra) break; ids.push(extra.id); }
  const drills = ids.map(id => { const item = stage.items.find(i => i.id === id);
    return { checklistId: id, title: `Explain: ${item.title}`, prompt: `In under 90 seconds, explain ${item.title.toLowerCase()}. Aim for: ${item.good}`, seconds: 90 }; });
  return { focus: stage.items.find(i => i.id === ids[0])?.title || "Your core explanation",
    why: a.attempts ? "This point was unclear or missing most often in your recent pitches." : "This is a key point for your stage, and a good place to start.",
    drills, milestone: a.latest != null ? `Raise your next full interview above ${Math.min(100, a.latest + 10)}.` : "Complete one full interview to get a baseline." };
}

const planSystem = (stage, analysis) => `You are Clarity AI's practice-plan agent. The user is rehearsing a ${ctxOf(stage).what} for ${ctxOf(stage).listener}. You have already gathered their recent practice reports and analysed them (ANALYSIS below). Plan their next practice session: one focus, why it matters here, exactly 3 short drills (each targets ONE checklist id), and one measurable milestone. Be specific, warm and practical. Never invent facts about them; drills ask them to explain, test or quantify things themselves. Write in the language the user practises in (default plain English).

CHECKLIST (id: element: what good looks like)
${checklistText(stage)}

ANALYSIS: ${JSON.stringify(analysis)}

Return ONLY JSON:
{"focus":"<short title>","why":"<1-2 sentences>","drills":[{"checklistId":"<id from checklist>","title":"<short>","prompt":"<what to say in 60-90 seconds>","seconds":60|90}],"milestone":"<measurable target for the next full interview>"}`;

function normPlan(stage, out, a) {
  const fb = fallbackPlan(stage, a);
  const ids = new Set(stage.items.map(i => i.id));
  const drills = arr(out?.drills, 3).map(d => ({ checklistId: str(d?.checklistId, 40), title: str(d?.title, 80), prompt: str(d?.prompt, 400), seconds: [60, 90].includes(num(d?.seconds)) ? num(d.seconds) : 90 }))
    .filter(d => ids.has(d.checklistId) && d.prompt);
  while (drills.length < 3 && fb.drills[drills.length]) drills.push(fb.drills[drills.length]);
  return { focus: str(out?.focus, 80) || fb.focus, why: str(out?.why, 400) || fb.why, drills, milestone: str(out?.milestone, 200) || fb.milestone };
}

const drillSystem = (stage, item) => `You are a warm, sharp speaking coach. The user just did a short drill on ONE point of their ${ctxOf(stage).what}: "${item.title}" (what good looks like: ${item.good}). Judge only that point: substance, clarity and confidence. Never correct grammar, accent or vocabulary; the transcript may come from speech recognition. Reply in their language mix. Never invent facts; use [placeholders].
Return ONLY JSON: {"verdict":"nailed|close|retry","score":0-10,"whatWorked":"<one sentence quoting them>","improve":"<the single most useful change>","tryLine":"<a better 1-2 sentence version built from their words, with [placeholders] for missing facts>"}`;

const followupSystem = (stage) => `You are ${ctxOf(stage).persona}. After their ${ctxOf(stage).what} you asked a tough follow-up question; now grade their answer. Reward directness, relevant evidence, honest uncertainty and a clear next step. Never judge grammar or accent; reply in their language mix. Never invent facts; use [placeholders].
Return ONLY JSON: {"verdict":"strong|okay|weak","score":0-10,"reaction":"<1-2 sentences, spoken, in character>","feedback":"<what to change>","betterAnswer":"<a tighter 2-4 sentence answer built from their words, with [placeholders]>"}`;

const offlineGrade = (text, kind) => {
  const words = (text.match(/\S+/g) || []).length, numbers = (text.match(/\d/g) || []).length;
  const score = clamp(Math.round(2 + Math.min(4, words / 25) + Math.min(3, numbers)), 0, 9);
  const verdict = kind === "drill" ? (score >= 7 ? "nailed" : score >= 5 ? "close" : "retry") : (score >= 7 ? "strong" : score >= 5 ? "okay" : "weak");
  return { verdict, score, offline: true };
};

export function registerAgents(app, { db, rateLimit, track, userIdOf }) {
  app.post("/api/agent/plan", rateLimit, async (req, res) => {
    const stage = trackFrom(req.body) || STAGES[0];
    const trace = [];
    // Step 1: gather history (tool). Signed-in: the database. Guest: reports kept in this browser tab.
    let history = [];
    const userId = userIdOf(req);
    if (userId && db && !stage.custom) {
      try {
        const { rows } = await db.query("SELECT report, stage, created_at FROM clarity_attempts WHERE user_id=$1 AND stage=$2 ORDER BY created_at DESC LIMIT 8", [userId, stage.id]);
        history = rows.map(r => digest({ ...r.report, at: r.created_at?.toISOString?.() || r.created_at }, r.stage)).filter(Boolean);
        trace.push({ step: "gather", detail: `Loaded ${history.length} saved ${stage.name} pitch report${history.length === 1 ? "" : "s"} from your account.` });
      } catch { trace.push({ step: "gather", detail: "Couldn't load saved reports; using this session only." }); }
    }
    if (!history.length) {
      history = arr(req.body?.recent, 5).map(r => digest(r, stage.id)).filter(h => h && (stage.custom || h.stage === stage.id));
      trace.push({ step: "gather", detail: history.length ? `Using ${history.length} report${history.length === 1 ? "" : "s"} from this browser session.` : "No reports yet; planning from your stage checklist." });
    }
    // Step 2: analyse (deterministic, auditable).
    const analysis = analyse(history, stage);
    trace.push({ step: "analyse", detail: analysis.attempts
      ? `Best ${analysis.best}, latest ${analysis.latest}${analysis.trend != null ? `, trend ${analysis.trend >= 0 ? "+" : ""}${analysis.trend}` : ""}. Weakest area: ${analysis.weakestDim}. Recurring gaps: ${analysis.topGaps.map(id => stage.items.find(i => i.id === id)?.title).filter(Boolean).join(", ") || "none"}.`
      : "Starting from the key points for this practice." });
    // Step 3: plan (LLM), Step 4: validate against the rubric.
    let plan, offline = false;
    if (aiStatus().ready) {
      try { plan = normPlan(stage, await callLLMJson(planSystem(stage, analysis), "Plan the next session. Return ONLY JSON.", { maxTokens: 900, timeoutMs: 30000 }), analysis); trace.push({ step: "plan", detail: "Drafted a plan with the AI coach." }); }
      catch (e) { console.error("plan:", e.message); }
    }
    if (!plan) { plan = fallbackPlan(stage, analysis); offline = true; trace.push({ step: "plan", detail: "Used the rule-based planner (AI unavailable)." }); }
    trace.push({ step: "validate", detail: `Checked every drill against the ${stage.custom ? stage.name : `${stage.name} pitch`} checklist.` });
    track("agent_review", str(req.body?.sid, 40));
    res.json({ stage: stage.id, scenario: stage.custom ? stage.scenario : undefined, analysis, plan, trace, offline });
  });

  app.post("/api/drill", rateLimit, async (req, res) => {
    const stage = trackFrom(req.body);
    const item = stage?.items.find(i => i.id === str(req.body?.checklistId, 40));
    const transcript = str(req.body?.transcript, 4000);
    if (!stage || !item) return res.status(400).json({ error: "Choose a stage and checklist point." });
    if ((transcript.match(/\S+/g) || []).length < 8) return res.status(422).json({ error: "Say a little more: at least a couple of sentences." });
    if (!aiStatus().ready) return res.json({ ...offlineGrade(transcript, "drill"), whatWorked: "You made an attempt at this point.", improve: `Aim for: ${item.good}`, tryLine: `[Your one-sentence answer about ${item.title.toLowerCase()}]` });
    try {
      const out = await callLLMJson(drillSystem(stage, item), `<transcript>\n${transcript}\n</transcript>\nReturn ONLY JSON.`, { maxTokens: 600, timeoutMs: 25000 });
      res.json({ verdict: ["nailed", "close", "retry"].includes(out?.verdict) ? out.verdict : "close", score: clamp(Math.round(num(out?.score, 5)), 0, 10),
        whatWorked: str(out?.whatWorked, 300), improve: str(out?.improve, 300), tryLine: str(out?.tryLine, 500) });
    } catch (e) { console.error("drill:", e.message); res.status(502).json({ error: "The drill coach is unavailable. Try again." }); }
  });

  app.post("/api/followup", rateLimit, async (req, res) => {
    const stage = trackFrom(req.body);
    const question = str(req.body?.question, 400), answer = str(req.body?.answer, 4000), context = str(req.body?.pitchInOneLine, 400);
    if (!stage || !question) return res.status(400).json({ error: "Missing the question." });
    if ((answer.match(/\S+/g) || []).length < 8) return res.status(422).json({ error: "Give a fuller answer: at least a couple of sentences." });
    if (!aiStatus().ready) return res.json({ ...offlineGrade(answer, "followup"), reaction: "Thanks. That's a start.", feedback: "Lead with a direct answer, then one piece of evidence and a next step.", betterAnswer: "[Direct answer]. [One fact or test result]. [What you'll do next and when]." });
    try {
      const out = await callLLMJson(followupSystem(stage), `PITCH IN ONE LINE: ${context || "(not given)"}\nQUESTION: ${question}\n<answer>\n${answer}\n</answer>\nReturn ONLY JSON.`, { maxTokens: 700, timeoutMs: 25000 });
      res.json({ verdict: ["strong", "okay", "weak"].includes(out?.verdict) ? out.verdict : "okay", score: clamp(Math.round(num(out?.score, 5)), 0, 10),
        reaction: str(out?.reaction, 300), feedback: str(out?.feedback, 400), betterAnswer: str(out?.betterAnswer, 700) });
    } catch (e) { console.error("followup:", e.message); res.status(502).json({ error: "Meera couldn't review your answer. Try again." }); }
  });
}
