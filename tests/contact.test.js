import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";
import express from "express";

process.env.CONTACT_WHATSAPP = "+91 90000 12345";
process.env.SESSION_SECRET = "contact-test-secret-with-more-than-thirty-two-characters";
const { registerContact, _test } = await import("../server/contact.js");

async function server(fetchImpl) {
  const app = express(); app.set("trust proxy", true); app.use(express.json());
  registerContact(app, { fetchImpl });
  const s = app.listen(0); await once(s, "listening");
  const base = `http://127.0.0.1:${s.address().port}`;
  let ip = 1;
  const post = (body, xff = `10.0.0.${ip++}`) => fetch(`${base}/api/contact`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": xff }, body: JSON.stringify(body) });
  return { s, base, post };
}
const solve = q => q.match(/(\d+) \+ (\d+)/).slice(1).reduce((a, b) => a + Number(b), 0);
// Tokens must be at least 3 s old; build an "old" valid one by signing in the past.
function aged(ms = 5000) { const real = Date.now; Date.now = () => real() - ms; try { return _test.challenge(Date.now()); } finally { Date.now = real; } }

test("a real person gets a WhatsApp link with their message; the number is only in that link", async () => {
  const { s, base, post } = await server();
  try {
    const page = await (await fetch(`${base}/api/contact`)).json();
    assert.equal(page.enabled, true);
    assert.doesNotMatch(JSON.stringify(page), /9000012345/);
    const c = aged();
    const r = await post({ name: "Priya Sharma", reason: "Feedback on interview practice", token: c.token, answer: String(solve(c.question)) });
    assert.equal(r.status, 200);
    const { url } = await r.json();
    assert.match(url, /^https:\/\/wa\.me\/919000012345\?text=/);
    assert.match(decodeURIComponent(url), /I'm Priya Sharma.*Feedback on interview practice/);
    // The same token can't be reused.
    const again = await post({ name: "Priya Sharma", reason: "Feedback on interview practice", token: c.token, answer: String(solve(c.question)) });
    assert.equal((await again.json()).error, "expired");
  } finally { s.close(); }
});

test("bots and spam are turned away", async () => {
  const { s, post } = await server();
  try {
    const c = aged(), answer = String(solve(c.question));
    const fresh = _test.challenge();
    const cases = [
      [{ name: "Bot", reason: "buy cheap stuff now", website: "http://spam", token: c.token, answer }, "bot"],
      [{ name: "Priya", reason: "hello there friend", token: fresh.token, answer: String(solve(fresh.question)) }, "too_fast"],
      [{ name: "Priya", reason: "hello there friend", token: aged().token, answer: "999" }, "wrong_answer"],
      [{ name: "Priya", reason: "see https://spam.example now", token: aged().token, answer }, "spam"],
      [{ name: "P", reason: "hi", token: aged().token, answer }, "invalid"],
      [{ name: "Priya", reason: "hello there friend", token: `${Date.now() - 5000}.abc.forgedsignature`, answer }, "wrong_answer"],
      [{ name: "Priya", reason: "hello there friend", token: aged(25 * 60 * 1000).token, answer }, "expired"],
    ];
    for (const [body, code] of cases) {
      const r = await post(body);
      const out = await r.json();
      assert.equal(out.error, code, JSON.stringify(body));
      assert.ok(!out.url);
    }
  } finally { s.close(); }
});

test("one visitor is limited to 5 attempts an hour", async () => {
  const { s, post } = await server();
  try {
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await post({ name: "Priya", reason: "hi", token: "x" }, "10.9.9.9")).status);
    assert.equal(codes[5], 429);
  } finally { s.close(); }
});

test("with Turnstile keys set, the Cloudflare check is required", async () => {
  process.env.TURNSTILE_SECRET_KEY = "secret";
  const seen = [];
  const { s, post } = await server(async (url, init) => { seen.push(String(init.body)); return new Response(JSON.stringify({ success: String(init.body).includes("response=good") })); });
  try {
    const a = aged(), b = aged();
    const bad = await post({ name: "Priya", reason: "hello there friend", token: a.token, answer: String(solve(a.question)), turnstile: "bad" });
    assert.equal((await bad.json()).error, "bot");
    const good = await post({ name: "Priya", reason: "hello there friend", token: b.token, answer: String(solve(b.question)), turnstile: "good" });
    assert.equal(good.status, 200);
    assert.equal(seen.length, 2);
  } finally { s.close(); delete process.env.TURNSTILE_SECRET_KEY; }
});

test("contact is off without CONTACT_WHATSAPP", async () => {
  const saved = process.env.CONTACT_WHATSAPP; delete process.env.CONTACT_WHATSAPP;
  const { s, base, post } = await server();
  try {
    assert.deepEqual(await (await fetch(`${base}/api/contact`)).json(), { enabled: false });
    assert.equal((await post({})).status, 404);
  } finally { s.close(); process.env.CONTACT_WHATSAPP = saved; }
});

test("no phone number or wa.me link is hard-coded in any public page", async () => {
  const dir = new URL("../public/", import.meta.url);
  for (const f of await readdir(dir)) {
    if (!/\.(html|js|json|webmanifest)$/.test(f)) continue;
    const text = await readFile(new URL(f, dir), "utf8");
    assert.doesNotMatch(text, /wa\.me\/\d|\+?91[\s-]?\d{5}[\s-]?\d{5}/, f);
  }
});
