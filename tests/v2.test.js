import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { registerAccountAuth } from "../server/account-auth.js";
import { registerGoogleAuth } from "../server/google-auth.js";
import { registerCommunity, saveVerifiedAttempt } from "../server/community.js";
import { createStats } from "../server/stats.js";
import { analyse } from "../server/agents.js";
import { registerVoice, synthesize } from "../server/voice.js";
import { faceFeatures, poseFeatures, createPresenceTracker, cleanPresence } from "../public/presence-metrics.js";
import { SCENARIOS, normalizeScenario, scenarioTrack } from "../public/scenarios.js";
import { stageById } from "../public/rubrics.js";

const SECRET = "a-development-test-secret-with-more-than-thirty-two-characters";
async function freshDb() {
  const db = new PGlite();
  await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")); // migrations are idempotent
  return db;
}
async function serve(app) {
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

test("Google sign-in: PKCE redirect, signed state, account creation, reuse and deletion", async () => {
  process.env.GOOGLE_CLIENT_ID = "client-123.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "shh";
  const db = await freshDb();
  const calls = [];
  const fakeGoogle = async (url, opts = {}) => {
    calls.push(String(url));
    if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
      const body = new URLSearchParams(opts.body);
      assert.equal(body.get("code"), "good-code");
      assert.ok(body.get("code_verifier")?.length > 40);
      return new Response(JSON.stringify({ access_token: "at" }), { status: 200 });
    }
    assert.equal(opts.headers.authorization, "Bearer at");
    return new Response(JSON.stringify({ sub: "g-42", email: "priya.sharma@example.com", email_verified: true, name: "Priya Sharma", picture: "https://example.com/p.png" }), { status: 200 });
  };
  const app = express(); app.set("trust proxy", true); app.use(express.json());
  const auth = registerAccountAuth(app, { db, sessionSecret: SECRET });
  registerGoogleAuth(app, { db, sessionSecret: SECRET, fetchImpl: fakeGoogle });
  app.use("/api", auth.sessionMiddleware);
  registerCommunity(app, { db });
  const { server, origin } = await serve(app);
  try {
    const start = await fetch(`${origin}/auth/google?return=/%23/progress`, { redirect: "manual" });
    assert.equal(start.status, 302);
    const loc = new URL(start.headers.get("location"));
    assert.equal(loc.host, "accounts.google.com");
    assert.equal(loc.searchParams.get("code_challenge_method"), "S256");
    assert.equal(loc.searchParams.get("redirect_uri"), `${origin}/auth/google/callback`);
    const stateCookie = start.headers.get("set-cookie").split(";")[0];
    const state = loc.searchParams.get("state");

    const forged = await fetch(`${origin}/auth/google/callback?state=wrong&code=good-code`, { redirect: "manual", headers: { cookie: stateCookie } });
    assert.match(forged.headers.get("location"), /error=google_expired/);

    const done = await fetch(`${origin}/auth/google/callback?state=${state}&code=good-code`, { redirect: "manual", headers: { cookie: stateCookie } });
    assert.equal(done.status, 302);
    assert.equal(done.headers.get("location"), "/#/progress");
    const session = done.headers.getSetCookie().find(c => c.startsWith("clarity_session="));
    assert.ok(session, "session cookie set");
    const cookie = session.split(";")[0];
    const me = await (await fetch(`${origin}/api/auth/me`, { headers: { cookie } })).json();
    assert.deepEqual(me.user, { username: "priya.sharma", displayName: "Priya Sharma", avatarUrl: "https://example.com/p.png", google: true });

    // Signing in again with the same Google account reuses it.
    const again = await fetch(`${origin}/auth/google`, { redirect: "manual" });
    const st2 = new URL(again.headers.get("location")).searchParams.get("state");
    await fetch(`${origin}/auth/google/callback?state=${st2}&code=good-code`, { redirect: "manual", headers: { cookie: again.headers.get("set-cookie").split(";")[0] } });
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM clarity_auth_users")).rows[0].n, 1);

    // Google users can't be logged into with a password; deleting the account removes scores too.
    const userId = `local:${(await db.query("SELECT id FROM clarity_auth_users")).rows[0].id}`;
    await saveVerifiedAttempt(db, userId, { overall: 70 }, "seed", "spoken");
    const del = await fetch(`${origin}/api/me`, { method: "DELETE", headers: { cookie, origin } });
    assert.equal(del.status, 200);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM clarity_attempts")).rows[0].n, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM clarity_auth_users")).rows[0].n, 0);
  } finally { server.close(); delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; }
});

test("custom scenario attempts save privately and can't be published", async () => {
  const db = await freshDb();
  const saved = await saveVerifiedAttempt(db, "local:x", { overall: 66 }, "custom", "spoken");
  assert.equal(saved.leaderboardStatus, "private");
  const r = await db.query("UPDATE clarity_attempts SET published=TRUE WHERE stage <> 'custom' RETURNING id");
  assert.equal(r.rows.length, 0);
});

// Synthetic face mesh: 478 points with the landmarks the metrics use placed for a person looking at the camera.
function face({ yaw = 0, gaze = 0 } = {}) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[234] = { x: 0.4, y: 0.5 }; lm[454] = { x: 0.6, y: 0.5 };
  lm[1] = { x: 0.5 + yaw * 0.2, y: 0.52 }; lm[10] = { x: 0.5, y: 0.35 }; lm[152] = { x: 0.5, y: 0.7 };
  lm[33] = { x: 0.43, y: 0.45 }; lm[133] = { x: 0.47, y: 0.45 }; lm[362] = { x: 0.53, y: 0.45 }; lm[263] = { x: 0.57, y: 0.45 };
  lm[468] = { x: 0.45 + gaze * 0.04, y: 0.45 }; lm[473] = { x: 0.55 + gaze * 0.04, y: 0.45 };
  return lm;
}
function pose({ tilt = 0, wrist = 0.6 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  lm[0] = { x: 0.5, y: 0.35, visibility: 1 };
  lm[11] = { x: 0.62, y: 0.6 + tilt, visibility: 1 }; lm[12] = { x: 0.38, y: 0.6, visibility: 1 };
  lm[15] = { x: wrist, y: 0.8, visibility: 0.9 }; lm[16] = { x: 1 - wrist, y: 0.8, visibility: 0.9 };
  return lm;
}

test("body-language metrics: eye contact, posture, gestures, nudges and validation", () => {
  assert.equal(faceFeatures(face()).eyeContact, true);
  assert.equal(faceFeatures(face({ yaw: 1 })).eyeContact, false);
  assert.equal(faceFeatures(face({ gaze: 1 })).eyeContact, false);
  assert.ok(poseFeatures(pose()).tilt < 1);
  assert.ok(poseFeatures(pose({ tilt: 0.1 })).tilt > 7);

  let t = 0;
  const tracker = createPresenceTracker({ now: () => t });
  for (let i = 0; i < 60; i++) { t += 100; tracker.add(faceFeatures(face()), poseFeatures(pose({ wrist: 0.6 + (i % 4) * 0.02 }))); }
  for (let i = 0; i < 60; i++) { t += 100; tracker.add(faceFeatures(face({ yaw: 1 })), poseFeatures(pose())); }
  const nudge = tracker.nudge();
  assert.equal(nudge?.kind, "eyes", "looking away triggers the eye-contact nudge");
  assert.equal(tracker.nudge(), null, "nudges are rate-limited");
  const s = tracker.summary();
  assert.equal(s.facePresentPct, 100);
  assert.ok(s.eyeContactPct > 40 && s.eyeContactPct < 60);
  assert.ok(s.score > 0 && s.score <= 10);
  assert.ok(Array.isArray(s.tips));

  const clean = cleanPresence({ ...s, eyeContactPct: 900, gestureLevel: "<script>", extra: "x" });
  assert.equal(clean.eyeContactPct, 100);
  assert.equal(clean.gestureLevel, null);
  assert.equal(clean.extra, undefined);
  assert.equal(cleanPresence({ sampledSec: 0 }), null);
});

test("scenarios: every template is valid, and bad AI output is repaired or rejected", () => {
  for (const sc of SCENARIOS) {
    const n = normalizeScenario(sc);
    assert.ok(n, sc.id);
    assert.ok(n.items.some(i => i.must));
    assert.equal(scenarioTrack(n).custom, true);
  }
  assert.equal(normalizeScenario({ name: "x", items: [{ title: "a", good: "b" }] }), null, "needs 3+ points");
  const fixed = normalizeScenario({ name: "Board update", timeLimitSec: 99999, items: [
    { id: "1bad id!", title: "Numbers", good: "Share KPIs." }, { id: "1bad id!", title: "Risks", good: "Name them." }, { title: "Ask", good: "Clear ask." }] });
  assert.equal(fixed.timeLimitSec, 600);
  assert.equal(new Set(fixed.items.map(i => i.id)).size, 3, "ids are unique");
  assert.ok(fixed.items.every(i => /^[a-zA-Z][a-zA-Z0-9]*$/.test(i.id)));
  assert.equal(fixed.items[0].must, true, "at least one must-have");
});

test("practice-plan analysis finds recurring gaps and trends", () => {
  const seed = stageById("seed");
  const mk = (overall, at, gaps) => ({ stage: "seed", overall, at, scores: { structure: 6, clarity: 7, substance: 4, delivery: 6 }, gaps, presence: null, fillers: 3, wpm: 140 });
  const a = analyse([mk(50, "2026-10-01", [{ id: "ask", status: "missing" }, { id: "traction", status: "weak" }]), mk(62, "2026-10-08", [{ id: "ask", status: "missing" }])], seed);
  assert.equal(a.topGaps[0], "ask");
  assert.equal(a.trend, 12);
  assert.equal(a.weakestDim, "substance");
  assert.equal(analyse([], seed).attempts, 0);
});

test("ElevenLabs: picks another account voice when the default is unavailable", async () => {
  process.env.ELEVENLABS_API_KEY = "el";
  let ttsCalls = [];
  const fake = async (url) => {
    url = String(url);
    if (url.endsWith("/v1/voices")) return new Response(JSON.stringify({ voices: [{ voice_id: "indian-f", labels: { gender: "female", accent: "indian" } }, { voice_id: "m1", labels: { gender: "male" } }] }));
    ttsCalls.push(url);
    if (url.includes("/21m00Tcm4TlvDq8ikWAM")) return new Response("voice_not_found", { status: 404 });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  };
  const buf = await synthesize("Hello", "meera", fake);
  assert.equal(buf.length, 3);
  assert.ok(ttsCalls.some(u => u.includes("/indian-f")));
  delete process.env.ELEVENLABS_API_KEY;
});

test("Whisper transcription route forwards audio and returns segments", async () => {
  process.env.STT_API_KEY = "gsk"; process.env.STT_BASE_URL = "http://stt.local/v1";
  let sent;
  const fake = async (url, opts) => { sent = { url: String(url), form: opts.body }; return new Response(JSON.stringify({ text: "hello world", duration: 3, segments: [{ start: 0, end: 1.2, text: " hello" }, { start: 4.1, end: 5, text: "world" }] })); };
  const app = express();
  registerVoice(app, { rateLimit: (q, r, n) => n(), track: () => {}, fetchImpl: fake });
  const { server, origin } = await serve(app);
  try {
    const bad = await fetch(`${origin}/api/transcribe`, { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
    assert.equal(bad.status, 415);
    const ok = await fetch(`${origin}/api/transcribe?lang=es-ES`, { method: "POST", headers: { "content-type": "audio/webm" }, body: new Uint8Array(2000) });
    const data = await ok.json();
    assert.equal(ok.status, 200);
    assert.equal(data.text, "hello world");
    assert.equal(data.segments[1].start, 4.1);
    assert.equal(sent.url, "http://stt.local/v1/audio/transcriptions");
    assert.equal(sent.form.get("model"), "whisper-large-v3-turbo");
    assert.equal(sent.form.get("language"), "es");
  } finally { server.close(); delete process.env.STT_API_KEY; delete process.env.STT_BASE_URL; }
});

test("usage counters persist in Postgres with hashed visitor ids", async () => {
  const db = await freshDb();
  const stats = createStats(db, "salt");
  stats.track("visit", "abcdefgh-1234"); stats.track("visit", "abcdefgh-1234"); stats.track("report", "abcdefgh-1234"); stats.track("nope", "x");
  await new Promise(r => setTimeout(r, 200));
  const s = await stats.summary();
  assert.equal(s.storage, "database");
  assert.equal(s.events.visit, 2);
  assert.equal(s.events.report, 1);
  assert.equal(s.uniqueVisitors, 1);
  const raw = await db.query("SELECT visitor_hash FROM clarity_visitors");
  assert.notEqual(raw.rows[0].visitor_hash, "abcdefgh-1234");
});
