// Verified contact: the WhatsApp number is never in the page or the repo. A visitor fills a short form and passes a
// human check; only then does the server return a wa.me link with their name and reason already typed in.
// Env: CONTACT_WHATSAPP (digits with country code, e.g. 9198xxxxxxxx; contact is off without it),
//      CONTACT_NAME (shown on the page, default "the team"),
//      TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY (optional Cloudflare Turnstile, free) for a stronger bot check.
// Built-in checks without Turnstile: signed one-time question, minimum fill time, hidden honeypot field,
// link/spam filter and a per-IP limit of 5 requests per hour.
import { createHmac, randomInt, randomBytes, timingSafeEqual } from "node:crypto";

const env = k => (process.env[k] || "").trim();
const number = () => env("CONTACT_WHATSAPP").replace(/\D/g, "");
const secret = () => env("SESSION_SECRET") || env("CONTACT_SECRET") || "clarity-contact-default-secret";
const sign = s => createHmac("sha256", secret()).update(s).digest("base64url");
const MIN_MS = 3000, MAX_MS = 20 * 60 * 1000;

export const contactConfigured = () => number().length >= 8;

// Token = issuedAt.nonce.signature(issuedAt.nonce.answer): the answer stays on the server side of the signature.
function challenge(now = Date.now()) {
  const a = randomInt(2, 10), b = randomInt(2, 10), nonce = randomBytes(9).toString("base64url");
  return { question: `What is ${a} + ${b}?`, token: `${now}.${nonce}.${sign(`${now}.${nonce}.${a + b}`)}` };
}

const used = new Map(); // nonce -> expiry (best-effort replay protection per instance)
function checkToken(token, answer, now = Date.now()) {
  const [at, nonce, sig] = String(token || "").split(".");
  const issued = Number(at);
  if (!issued || !nonce || !sig) return "expired";
  if (now - issued < MIN_MS) return "too_fast";
  if (now - issued > MAX_MS) return "expired";
  const expected = Buffer.from(sign(`${at}.${nonce}.${Number.parseInt(answer, 10)}`)), got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return "wrong_answer";
  if (used.has(nonce)) return "expired";
  used.set(nonce, now + MAX_MS);
  if (used.size > 5000) for (const [k, exp] of used) if (exp < now) used.delete(k);
  return null;
}

async function turnstileOk(token, ip, fetchImpl) {
  if (!env("TURNSTILE_SECRET_KEY")) return true;
  if (!token) return false;
  try {
    const r = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", signal: AbortSignal.timeout(8000),
      body: new URLSearchParams({ secret: env("TURNSTILE_SECRET_KEY"), response: token, remoteip: ip || "" }),
    });
    return !!(await r.json()).success;
  } catch { return false; }
}

const hits = new Map();
function limited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= 5) return true;
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k);
  return false;
}

const MESSAGES = {
  off: "Contact isn't set up on this server yet.",
  too_fast: "That was quick! Please wait a moment and try again.",
  expired: "This form expired. Please try again.",
  wrong_answer: "That answer isn't right. Please try again.",
  bot: "We couldn't verify you're human. Please try again.",
  invalid: "Please add your name and a short reason (at least a few words).",
  spam: "Please remove links from your message.",
  limit: "Too many requests. Please try again in an hour.",
};

export function registerContact(app, { fetchImpl = (...a) => fetch(...a), track } = {}) {
  app.get("/api/contact", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!contactConfigured()) return res.json({ enabled: false });
    res.json({ enabled: true, name: env("CONTACT_NAME") || "the team", turnstileSiteKey: env("TURNSTILE_SITE_KEY") || null, ...challenge() });
  });

  app.post("/api/contact", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const fail = (code, status = 400) => res.status(status).json({ error: code, message: MESSAGES[code] });
    if (!contactConfigured()) return fail("off", 404);
    const b = req.body || {};
    if (b.website) return fail("bot");                                  // honeypot: hidden from people, filled by bots
    if (limited(req.ip || "x")) return fail("limit", 429);
    const name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const reason = String(b.reason || "").trim().replace(/\s+/g, " ").slice(0, 400);
    if (name.length < 2 || reason.split(" ").length < 3) return fail("invalid");
    if (/(https?:\/\/|www\.|\.(ru|xyz|top|click)\b)/i.test(`${name} ${reason}`)) return fail("spam");
    const problem = checkToken(b.token, b.answer);
    if (problem) return fail(problem);
    if (!(await turnstileOk(b.turnstile, req.ip, fetchImpl))) return fail("bot");
    track?.("contact", b.sid);
    const text = `Hi! I'm ${name}. I found Clarity AI and I'd like to talk about: ${reason}`;
    res.json({ url: `https://wa.me/${number()}?text=${encodeURIComponent(text)}` });
  });
}

export const _test = { challenge, checkToken, MIN_MS };
