// GitHub, LinkedIn and Microsoft sign-in, account linking, and the security rules shared by every provider.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { registerAccountAuth } from "../server/account-auth.js";
import { registerOAuth, PROVIDERS, configuredProviders } from "../server/oauth.js";

const SECRET = "a-development-test-secret-with-more-than-thirty-two-characters";
const KEYS = ["GOOGLE", "GITHUB", "LINKEDIN", "MICROSOFT"];
for (const k of KEYS) { process.env[`${k}_CLIENT_ID`] = `${k.toLowerCase()}-id`; process.env[`${k}_CLIENT_SECRET`] = `${k.toLowerCase()}-secret`; }

// Fake provider APIs. `people` maps an access token to the profile that provider returns.
function fakeProviders(people) {
  const tokenCalls = [];
  const fetchImpl = async (url, opts = {}) => {
    url = String(url);
    const auth = (opts.headers?.authorization || "").replace("Bearer ", "");
    if (Object.values(PROVIDERS).some(p => p.token === url)) {
      const body = new URLSearchParams(opts.body);
      tokenCalls.push({ url, body: Object.fromEntries(body) });
      return new Response(JSON.stringify({ access_token: body.get("code") }), { status: 200 });
    }
    const who = people[auth];
    if (!who) return new Response("bad token", { status: 401 });
    if (url === "https://api.github.com/user") return new Response(JSON.stringify({ id: who.id, login: who.login, name: who.name, avatar_url: who.avatar }));
    if (url === "https://api.github.com/user/emails") return new Response(JSON.stringify(who.emails || []));
    return new Response(JSON.stringify({ sub: who.id, email: who.email, email_verified: who.verified ?? true, name: who.name, picture: who.avatar }));
  };
  return { fetchImpl, tokenCalls };
}

async function setup(people) {
  const db = new PGlite();
  await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const { fetchImpl, tokenCalls } = fakeProviders(people);
  const app = express(); app.set("trust proxy", true); app.use(express.json());
  const auth = registerAccountAuth(app, { db, sessionSecret: SECRET });
  registerOAuth(app, { db, sessionSecret: SECRET, fetchImpl });
  app.use("/api", auth.sessionMiddleware);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  // Runs a full sign-in: start → provider → callback with `code` (the fake access token). Returns the redirect + cookies.
  async function signIn(provider, code, { cookie = "", returnTo } = {}) {
    const start = await fetch(`${origin}/auth/${provider}${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ""}`, { redirect: "manual", headers: { cookie } });
    const loc = new URL(start.headers.get("location"));
    const state = start.headers.get("set-cookie").split(";")[0];
    const done = await fetch(`${origin}/auth/${provider}/callback?state=${loc.searchParams.get("state")}&code=${code}`,
      { redirect: "manual", headers: { cookie: [cookie, state].filter(Boolean).join("; ") } });
    const session = done.headers.getSetCookie().find(c => c.startsWith("clarity_session="))?.split(";")[0];
    return { authorize: loc, location: done.headers.get("location"), session };
  }
  const me = async cookie => (await (await fetch(`${origin}/api/auth/me`, { headers: { cookie } })).json()).user;
  const count = async t => (await db.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n;
  return { db, server, origin, signIn, me, count, tokenCalls };
}

test("all four providers are offered when their keys are set", () => {
  assert.deepEqual(configuredProviders(), ["google", "github", "linkedin", "microsoft"]);
});

test("GitHub, LinkedIn and Microsoft each create an account with the right details", async () => {
  const t = await setup({
    gh: { id: 101, login: "riya-dev", name: "Riya Sen", avatar: "https://avatars.example/r.png", emails: [{ email: "riya@example.com", primary: true, verified: true }] },
    li: { id: "li-7", email: "arjun@example.com", name: "Arjun Mehta", avatar: "https://media.licdn.example/a.jpg" },
    ms: { id: "ms-9", email: "neha@outlook.example", name: "Neha Gupta" },
  });
  try {
    const gh = await t.signIn("github", "gh");
    assert.equal(gh.authorize.host, "github.com");
    assert.equal(gh.authorize.searchParams.get("code_challenge_method"), "S256");
    assert.deepEqual(await t.me(gh.session), { username: "riya-dev", displayName: "Riya Sen", avatarUrl: "https://avatars.example/r.png", google: false, provider: "github" });

    const li = await t.signIn("linkedin", "li");
    assert.equal(li.authorize.host, "www.linkedin.com");
    assert.equal(li.authorize.searchParams.get("scope"), "openid profile email");
    assert.equal(li.authorize.searchParams.get("code_challenge"), null, "LinkedIn's web flow doesn't take PKCE");
    assert.equal((await t.me(li.session)).provider, "linkedin");

    const ms = await t.signIn("microsoft", "ms");
    assert.equal(ms.authorize.host, "login.microsoftonline.com");
    assert.deepEqual(await t.me(ms.session), { username: "neha", displayName: "Neha Gupta", avatarUrl: null, google: false, provider: "microsoft" });

    assert.equal(await t.count("clarity_auth_users"), 3);
    // The PKCE verifier is sent exactly where the provider supports it.
    const sent = Object.fromEntries(t.tokenCalls.map(c => [new URL(c.url).host, !!c.body.code_verifier]));
    assert.deepEqual(sent, { "github.com": true, "www.linkedin.com": false, "login.microsoftonline.com": true });
    // Signing in again reuses the account.
    await t.signIn("github", "gh");
    assert.equal(await t.count("clarity_auth_users"), 3);
  } finally { t.server.close(); }
});

test("accounts are never matched by email, so a same-email account on another provider can't take one over", async () => {
  const t = await setup({ g: { id: "g-1", email: "same@example.com", name: "Real Owner" }, m: { id: "m-1", email: "same@example.com", name: "Someone Else" } });
  try {
    const a = await t.signIn("google", "g"), b = await t.signIn("microsoft", "m");
    assert.notEqual((await t.me(a.session)).username, (await t.me(b.session)).username);
    assert.equal(await t.count("clarity_auth_users"), 2);
  } finally { t.server.close(); }
});

test("a signed-in user can connect more providers to the same account, but not one owned by someone else", async () => {
  const t = await setup({ g: { id: "g-1", email: "p@example.com", name: "Priya" }, gh: { id: 5, login: "priya", name: "Priya" }, other: { id: "g-2", email: "o@example.com", name: "Other" } });
  try {
    const first = await t.signIn("google", "g");
    const linked = await t.signIn("github", "gh", { cookie: first.session });
    assert.equal(linked.location, "/");
    assert.equal(await t.count("clarity_auth_users"), 1);
    assert.equal(await t.count("clarity_auth_identities"), 2);
    // Signing in with GitHub alone now opens the same account.
    assert.equal((await t.me((await t.signIn("github", "gh")).session)).displayName, "Priya");
    // Someone else's account can't be attached to Priya's.
    const otherUser = await t.signIn("google", "other");
    const steal = await t.signIn("github", "gh", { cookie: otherUser.session });
    assert.match(steal.location, /error=github_linked_elsewhere/);
  } finally { t.server.close(); }
});

test("security: forged state, another provider's state, unverified email, cancellations and unsafe redirects", async () => {
  const t = await setup({ u: { id: "li-x", email: "x@example.com", verified: false, name: "X" }, ok: { id: "ms-1", email: "ok@example.com", name: "OK" } });
  try {
    // State from a GitHub sign-in can't complete a Microsoft one.
    const start = await fetch(`${t.origin}/auth/github`, { redirect: "manual" });
    const state = new URL(start.headers.get("location")).searchParams.get("state");
    const cross = await fetch(`${t.origin}/auth/microsoft/callback?state=${state}&code=ok`, { redirect: "manual", headers: { cookie: start.headers.get("set-cookie").split(";")[0] } });
    assert.match(cross.headers.get("location"), /error=microsoft_expired/);
    // A tampered cookie is rejected.
    const tampered = start.headers.get("set-cookie").split(";")[0].replace(/.$/, c => (c === "A" ? "B" : "A"));
    const bad = await fetch(`${t.origin}/auth/github/callback?state=${state}&code=ok`, { redirect: "manual", headers: { cookie: tampered } });
    assert.match(bad.headers.get("location"), /error=github_expired/);
    // Unverified emails are refused.
    assert.match((await t.signIn("linkedin", "u")).location, /error=linkedin_unverified/);
    // The user pressing Cancel at the provider.
    const cancel = await fetch(`${t.origin}/auth/microsoft/callback?error=access_denied`, { redirect: "manual" });
    assert.match(cancel.headers.get("location"), /error=microsoft_cancelled/);
    // Only same-site return paths are honoured.
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example"]) {
      assert.equal((await t.signIn("microsoft", "ok", { returnTo: evil })).location, "/");
    }
    assert.equal((await t.signIn("microsoft", "ok", { returnTo: "/#/progress" })).location, "/#/progress");
    // The state cookie is HttpOnly and scoped to /auth.
    assert.match(start.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
    assert.match(start.headers.get("set-cookie"), /Path=\/auth;/);
  } finally { t.server.close(); }
});

test("a provider without keys sends people back with a clear message", async () => {
  const saved = process.env.LINKEDIN_CLIENT_ID; delete process.env.LINKEDIN_CLIENT_ID;
  const t = await setup({});
  try {
    const r = await fetch(`${t.origin}/auth/linkedin`, { redirect: "manual" });
    assert.match(r.headers.get("location"), /\/sign-in\?error=linkedin_unavailable/);
    assert.deepEqual(configuredProviders(), ["google", "github", "microsoft"]);
  } finally { t.server.close(); process.env.LINKEDIN_CLIENT_ID = saved; }
});
