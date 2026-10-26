// "Continue with Google / GitHub / LinkedIn / Microsoft": one OAuth 2.0 authorization-code flow for every provider.
// No SDKs. Security: signed, short-lived state cookie (CSRF), PKCE where the provider supports it, exact redirect URIs,
// verified email required where the provider reports it, open-redirect-safe return paths, and accounts are matched by
// the provider's stable user id, never by email (so nobody can take over an account by claiming the same email).
// A signed-in user who connects another provider links it to the same account.
// Env per provider: <NAME>_CLIENT_ID and <NAME>_CLIENT_SECRET (GOOGLE, GITHUB, LINKEDIN, MICROSOFT); optional PUBLIC_URL.
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createSession, noStore, cookieToken, sha256 } from "./account-auth.js";

const env = k => (process.env[k] || "").trim();
const STATE_COOKIE = "clarity_oauth";
const STATE_MS = 10 * 60 * 1000;
const json = async r => { if (!r.ok) throw new Error(`${r.url.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`); return r.json(); };
const https = v => (typeof v === "string" && v.startsWith("https://") ? v.slice(0, 500) : null);

export const PROVIDERS = {
  google: {
    label: "Google", envKey: "GOOGLE", pkce: true, scope: "openid email profile",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
    extra: { prompt: "select_account" },
    async profile(token, f) {
      const i = await json(await f("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }));
      return { id: i.sub, email: i.email, verified: i.email_verified !== false, name: i.name || i.given_name, avatar: i.picture };
    },
  },
  github: {
    label: "GitHub", envKey: "GITHUB", pkce: true, scope: "read:user user:email",
    authorize: "https://github.com/login/oauth/authorize", token: "https://github.com/login/oauth/access_token",
    async profile(token, f) {
      const h = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "Clarity-AI" };
      const u = await json(await f("https://api.github.com/user", { headers: h, signal: AbortSignal.timeout(10000) }));
      let email = null;
      try {
        const emails = await json(await f("https://api.github.com/user/emails", { headers: h, signal: AbortSignal.timeout(10000) }));
        email = (emails.find(e => e.primary && e.verified) || emails.find(e => e.verified))?.email || null;
      } catch {}
      return { id: u.id, email, verified: true, name: u.name || u.login, avatar: u.avatar_url, handle: u.login };
    },
  },
  linkedin: {
    // "Sign In with LinkedIn using OpenID Connect" product (free). LinkedIn's web flow doesn't take PKCE.
    label: "LinkedIn", envKey: "LINKEDIN", pkce: false, scope: "openid profile email",
    authorize: "https://www.linkedin.com/oauth/v2/authorization", token: "https://www.linkedin.com/oauth/v2/accessToken",
    async profile(token, f) {
      const i = await json(await f("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }));
      return { id: i.sub, email: i.email, verified: i.email_verified !== false, name: i.name || [i.given_name, i.family_name].filter(Boolean).join(" "), avatar: i.picture };
    },
  },
  microsoft: {
    // Personal Microsoft accounts and work/school accounts ("common" tenant).
    label: "Microsoft", envKey: "MICROSOFT", pkce: true, scope: "openid email profile User.Read",
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    extra: { prompt: "select_account" },
    async profile(token, f) {
      const i = await json(await f("https://graph.microsoft.com/oidc/userinfo", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }));
      return { id: i.sub, email: i.email, verified: true, name: i.name || i.given_name, avatar: null };
    },
  },
};

export const providerConfigured = name => { const p = PROVIDERS[name]; return !!(p && env(`${p.envKey}_CLIENT_ID`) && env(`${p.envKey}_CLIENT_SECRET`)); };
export const configuredProviders = () => Object.keys(PROVIDERS).filter(providerConfigured);

function origin(req) {
  if (env("PUBLIC_URL")) return env("PUBLIC_URL").replace(/\/+$/, "");
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}
export const redirectUri = (req, name) => `${origin(req)}/auth/${name}/callback`;
const isSecure = req => process.env.NODE_ENV !== "test" && origin(req).startsWith("https://");
const sign = (secret, value) => createHmac("sha256", secret).update(value).digest("base64url");
const safeReturn = to => (typeof to === "string" && /^\/(#\/[a-z/-]*)?$/.test(to) ? to : "/");
const cookie = (req, value, maxAge) => `${STATE_COOKIE}=${value}; Max-Age=${maxAge}; Path=/auth; HttpOnly; SameSite=Lax${isSecure(req) ? "; Secure" : ""}`;

function readState(req, secret, name) {
  const raw = (req.get("cookie") || "").split(";").map(p => p.trim()).find(p => p.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(secret, body)), got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return data.p === name && Date.now() - data.t < STATE_MS ? data : null;
  } catch { return null; }
}

// A readable, unique username for a new account, e.g. "priya.sharma" or "priya.sharma4821".
async function uniqueUsername(db, ...hints) {
  const seed = hints.map(h => String(h || "").split("@")[0]).find(h => h) || "member";
  const base = seed.toLowerCase().normalize("NFKD").replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").replace(/^[^a-z0-9]+/, "").slice(0, 18) || "member";
  const padded = base.length >= 3 ? base : `${base}user`.slice(0, 18);
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? padded : `${padded}${Math.floor(1000 + Math.random() * 9000)}`;
    const { rows } = await db.query("SELECT 1 FROM clarity_auth_users WHERE username=$1", [candidate]);
    if (!rows.length) return candidate;
  }
  return `user${randomBytes(5).toString("hex")}`;
}

async function currentAccountId(db, req) {
  const token = cookieToken(req);
  if (!token) return null;
  const { rows } = await db.query("SELECT user_id FROM clarity_auth_sessions WHERE session_hash=$1 AND expires_at > NOW()", [sha256(token)]);
  return rows[0]?.user_id || null;
}

export function registerOAuth(app, { db, sessionSecret = process.env.SESSION_SECRET, fetchImpl = (...a) => fetch(...a), only } = {}) {
  const names = only || Object.keys(PROVIDERS);
  const fail = (res, name, code) => res.redirect(302, `/sign-in?error=${encodeURIComponent(`${name}_${code}`)}`);
  const ready = () => db && sessionSecret && sessionSecret.length >= 32;

  for (const name of names) {
    const p = PROVIDERS[name];
    const id = () => env(`${p.envKey}_CLIENT_ID`), secret = () => env(`${p.envKey}_CLIENT_SECRET`);

    app.get(`/auth/${name}`, (req, res) => {
      noStore(res);
      if (!providerConfigured(name) || !ready()) return fail(res, name, "unavailable");
      const state = randomBytes(24).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const body = Buffer.from(JSON.stringify({ p: name, s: state, v: p.pkce ? verifier : null, r: safeReturn(req.query.return), t: Date.now() })).toString("base64url");
      res.append("Set-Cookie", cookie(req, `${body}.${sign(sessionSecret, body)}`, STATE_MS / 1000));
      const url = new URL(p.authorize);
      url.search = new URLSearchParams({
        client_id: id(), redirect_uri: redirectUri(req, name), response_type: "code", scope: p.scope, state,
        ...(p.pkce ? { code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" } : {}),
        ...(p.extra || {}),
      }).toString();
      res.redirect(302, url.toString());
    });

    app.get(`/auth/${name}/callback`, async (req, res) => {
      noStore(res);
      res.append("Set-Cookie", cookie(req, "", 0));
      if (!providerConfigured(name) || !ready()) return fail(res, name, "unavailable");
      if (req.query.error) return fail(res, name, /access_denied|cancel/i.test(String(req.query.error)) ? "cancelled" : "failed");
      const saved = readState(req, sessionSecret, name);
      if (!saved || typeof req.query.state !== "string" || req.query.state !== saved.s || typeof req.query.code !== "string") return fail(res, name, "expired");
      try {
        const tokenRes = await fetchImpl(p.token, {
          method: "POST", signal: AbortSignal.timeout(10000),
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams({ code: req.query.code, client_id: id(), client_secret: secret(), redirect_uri: redirectUri(req, name),
            grant_type: "authorization_code", ...(saved.v ? { code_verifier: saved.v } : {}) }),
        });
        const tokens = await json(tokenRes);
        if (!tokens.access_token) throw new Error(`no access token (${tokens.error || "unknown"})`);
        const who = await p.profile(tokens.access_token, fetchImpl);
        if (!who.id) throw new Error("no user id");
        if (!who.verified) return fail(res, name, "unverified");
        const subject = String(who.id), email = who.email ? String(who.email).slice(0, 200) : null;
        const displayName = String(who.name || "").slice(0, 80) || null, avatar = https(who.avatar);

        const owner = (await db.query("SELECT user_id FROM clarity_auth_identities WHERE provider=$1 AND subject=$2", [name, subject])).rows[0]?.user_id;
        const signedIn = await currentAccountId(db, req);
        let userId = owner;
        if (signedIn && owner && owner !== signedIn) return fail(res, name, "linked_elsewhere");
        if (!userId && signedIn) {                       // connect this provider to the account you're signed in to
          userId = signedIn;
          await db.query("INSERT INTO clarity_auth_identities(provider,subject,user_id) VALUES($1,$2,$3)", [name, subject, userId]);
          await db.query("UPDATE clarity_auth_users SET display_name=COALESCE(display_name,$2), avatar_url=COALESCE(avatar_url,$3) WHERE id=$1", [userId, displayName, avatar]);
        } else if (!userId) {                            // first sign-in with this provider: new account
          userId = randomUUID();
          const username = await uniqueUsername(db, who.handle, email, displayName);
          await db.query("INSERT INTO clarity_auth_users(id,username,password_hash,google_sub,email,display_name,avatar_url,sso_provider) VALUES($1,$2,NULL,$3,$4,$5,$6,$7)",
            [userId, username, name === "google" ? subject : null, email, displayName, avatar, name]);
          await db.query("INSERT INTO clarity_auth_identities(provider,subject,user_id) VALUES($1,$2,$3)", [name, subject, userId]);
        } else {                                         // returning user: refresh their profile
          await db.query("UPDATE clarity_auth_users SET email=COALESCE($2,email), display_name=COALESCE($3,display_name), avatar_url=COALESCE($4,avatar_url) WHERE id=$1",
            [userId, email, displayName, avatar]);
        }
        await createSession(db, userId, req, res);
        return res.redirect(302, saved.r || "/");
      } catch (error) {
        console.error(`${p.label} sign-in failed:`, error.message);
        return fail(res, name, "failed");
      }
    });
  }
}
