// "Continue with Google": OAuth 2.0 authorization-code flow with PKCE and a signed state cookie.
// No SDK. On success it creates the same first-party session as username sign-in.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, optional PUBLIC_URL (fixes the redirect URI host).
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createSession, noStore } from "./account-auth.js";

const STATE_COOKIE = "clarity_oauth";
const STATE_MS = 10 * 60 * 1000;
const env = k => (process.env[k] || "").trim();
export const googleConfigured = () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));

function origin(req) {
  if (env("PUBLIC_URL")) return env("PUBLIC_URL").replace(/\/+$/, "");
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}
export const redirectUri = req => `${origin(req)}/auth/google/callback`;
const isSecure = req => process.env.NODE_ENV !== "test" && origin(req).startsWith("https://");
const sign = (secret, value) => createHmac("sha256", secret).update(value).digest("base64url");
const safeReturn = to => (typeof to === "string" && /^\/(#\/[a-z/-]*)?$/.test(to) ? to : "/");

function readState(req, secret) {
  const raw = (req.get("cookie") || "").split(";").map(p => p.trim()).find(p => p.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(secret, body)), got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return Date.now() - data.t < STATE_MS ? data : null;
  } catch { return null; }
}

// A readable, unique username for a new Google account, e.g. "priya.sharma" or "priya.sharma4821".
async function uniqueUsername(db, email, name) {
  const base = (String(email || "").split("@")[0] || String(name || "") || "founder")
    .toLowerCase().normalize("NFKD").replace(/[^a-z0-9._-]/g, "").replace(/^[^a-z0-9]+/, "").slice(0, 18) || "founder";
  const padded = base.length >= 3 ? base : `${base}user`.slice(0, 18);
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? padded : `${padded}${Math.floor(1000 + Math.random() * 9000)}`;
    const { rows } = await db.query("SELECT 1 FROM clarity_auth_users WHERE username=$1", [candidate]);
    if (!rows.length) return candidate;
  }
  return `user${randomBytes(5).toString("hex")}`;
}

export function registerGoogleAuth(app, { db, sessionSecret = process.env.SESSION_SECRET, fetchImpl = (...a) => fetch(...a) } = {}) {
  const fail = (res, code) => res.redirect(302, `/sign-in?error=${encodeURIComponent(code)}`);

  app.get("/auth/google", (req, res) => {
    noStore(res);
    if (!googleConfigured() || !db || !sessionSecret || sessionSecret.length < 32) return fail(res, "google_unavailable");
    const state = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const body = Buffer.from(JSON.stringify({ s: state, v: verifier, r: safeReturn(req.query.return), t: Date.now() })).toString("base64url");
    res.append("Set-Cookie", `${STATE_COOKIE}=${body}.${sign(sessionSecret, body)}; Max-Age=${STATE_MS / 1000}; Path=/auth/google; HttpOnly; SameSite=Lax${isSecure(req) ? "; Secure" : ""}`);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"), redirect_uri: redirectUri(req), response_type: "code",
      scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
    }).toString();
    res.redirect(302, url.toString());
  });

  app.get("/auth/google/callback", async (req, res) => {
    noStore(res);
    res.append("Set-Cookie", `${STATE_COOKIE}=; Max-Age=0; Path=/auth/google; HttpOnly; SameSite=Lax${isSecure(req) ? "; Secure" : ""}`);
    if (!googleConfigured() || !db || !sessionSecret) return fail(res, "google_unavailable");
    if (req.query.error) return fail(res, req.query.error === "access_denied" ? "google_cancelled" : "google_failed");
    const saved = readState(req, sessionSecret);
    if (!saved || typeof req.query.state !== "string" || req.query.state !== saved.s || typeof req.query.code !== "string") return fail(res, "google_expired");
    try {
      const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: req.query.code, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
          redirect_uri: redirectUri(req), grant_type: "authorization_code", code_verifier: saved.v }),
      });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 200)}`);
      const { access_token: accessToken } = await tokenRes.json();
      const infoRes = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000),
      });
      if (!infoRes.ok) throw new Error(`userinfo ${infoRes.status}`);
      const info = await infoRes.json();
      if (!info.sub || info.email_verified === false) return fail(res, "google_unverified");
      const displayName = String(info.name || info.given_name || "").slice(0, 80) || null;
      const avatar = typeof info.picture === "string" && info.picture.startsWith("https://") ? info.picture.slice(0, 500) : null;
      let { rows } = await db.query("SELECT id FROM clarity_auth_users WHERE google_sub=$1", [String(info.sub)]);
      let userId = rows[0]?.id;
      if (userId) {
        await db.query("UPDATE clarity_auth_users SET email=$2, display_name=$3, avatar_url=$4 WHERE id=$1", [userId, info.email || null, displayName, avatar]);
      } else {
        userId = randomUUID();
        const username = await uniqueUsername(db, info.email, displayName);
        await db.query("INSERT INTO clarity_auth_users(id,username,password_hash,google_sub,email,display_name,avatar_url) VALUES($1,$2,NULL,$3,$4,$5,$6)",
          [userId, username, String(info.sub), info.email || null, displayName, avatar]);
      }
      await createSession(db, userId, req, res);
      return res.redirect(302, saved.r || "/");
    } catch (error) {
      console.error("Google sign-in failed:", error.message);
      return fail(res, "google_failed");
    }
  });
}
