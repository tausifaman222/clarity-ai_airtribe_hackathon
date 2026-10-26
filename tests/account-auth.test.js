import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { registerAccountAuth } from "../server/account-auth.js";
import { registerCommunity, saveVerifiedAttempt } from "../server/community.js";

test("salted username accounts securely own scores and can sign in and out", async () => {
  const db = new PGlite();
  await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  const auth = registerAccountAuth(app, { db, sessionSecret: "a-development-test-secret-with-more-than-thirty-two-characters" });
  app.use("/api", auth.sessionMiddleware);
  registerCommunity(app, { db });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, { method = "GET", body, cookie, requestOrigin = origin } = {}) => {
    const response = await fetch(origin + route, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(requestOrigin ? { origin: requestOrigin } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  };
  const register = (username, password, confirmation = password, requestOrigin = origin) => request("/api/auth/register", {
    method: "POST", body: { username, password, confirmation }, requestOrigin,
  });
  const login = (username, password) => request("/api/auth/login", {
    method: "POST", body: { username, password },
  });

  try {
    assert.equal((await register("bad", "short")).status, 400, "short passwords are rejected");
    assert.equal((await register("alice01", "long-password-one", "does-not-match")).status, 400, "password confirmation is required");
    assert.equal((await register("attacker01", "long-password-one", "long-password-one", "https://attacker.example")).status, 403, "browser account changes require same-origin requests");
    const created = await register("Founder_01", "long-password-one");
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { user: { username: "founder_01", displayName: null, avatarUrl: null, google: false, provider: null } });

    const cookie = created.headers.get("set-cookie").split(";")[0];
    assert.match(created.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(created.headers.get("set-cookie"), /SameSite=Lax/i);
    assert.match(created.headers.get("cache-control"), /no-store/i);
    const [stored] = (await db.query("SELECT id,username,password_hash FROM clarity_auth_users")).rows;
    assert.equal(stored.username, "founder_01", "usernames are normalized consistently");
    assert.match(stored.password_hash, /^scrypt\$/);
    assert.ok(!stored.password_hash.includes("long-password-one"), "password is never stored in readable form");
    const identity = await request("/api/auth/me", { cookie });
    assert.deepEqual(identity.body, { user: { username: "founder_01", displayName: null, avatarUrl: null, google: false, provider: null } });
    const [storedToken] = (await db.query("SELECT session_hash,expires_at FROM clarity_auth_sessions")).rows;
    assert.equal(storedToken.session_hash.length, 64);
    assert.notEqual(storedToken.session_hash, cookie.slice("clarity_session=".length), "the database stores a hash—not the session cookie");

    const userId = `local:${stored.id}`;
    const attempt = await saveVerifiedAttempt(db, userId, { overall: 87 }, "seed", "typed");
    assert.equal(attempt.leaderboardStatus, "private");
    const owned = await request("/api/me/attempts", { cookie });
    assert.equal(owned.status, 200);
    assert.equal(owned.body.attempts[0].score, 87);
    assert.equal((await request("/api/leaderboard?stage=seed&input=typed")).body.entries.length, 0, "scores stay private until the owner chooses to publish");
    const published = await request("/api/leaderboard/publish", {
      method: "POST", cookie, body: { attemptId: attempt.attemptId, displayName: "Founder01" },
    });
    assert.equal(published.status, 200);
    assert.deepEqual((await request("/api/leaderboard?stage=seed&input=typed")).body.entries.map(item => item.name), ["Founder01"]);

    const wrongPassword = await login("founder_01", "a-different-password");
    const unknownAccount = await login("unknown01", "a-different-password");
    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(unknownAccount.body, wrongPassword.body, "login errors don't reveal whether an account exists");
    const duplicate = await register("FOUNDER_01", "long-password-two");
    assert.equal(duplicate.status, 409, "usernames are case-insensitive");

    const second = await register("builder_02", "long-password-two");
    assert.equal(second.status, 201);
    const otherAccount = await request("/api/me/attempts", { cookie: second.headers.get("set-cookie").split(";")[0] });
    assert.equal(otherAccount.body.attempts.length, 0, "accounts cannot see each other's scores");

    const signedOut = await request("/api/auth/logout", { method: "POST", cookie });
    assert.equal(signedOut.status, 200);
    assert.match(signedOut.headers.get("set-cookie"), /Max-Age=0/);
    assert.deepEqual((await request("/api/auth/me", { cookie })).body, { user: null });
    assert.equal((await request("/api/me/attempts", { cookie })).status, 401, "logged-out sessions no longer access private scores");

    await login("founder_01", "long-password-one");
    let lastInvalid;
    for (let i = 0; i < 5; i++) lastInvalid = await login("founder_01", "not-the-correct-password");
    assert.equal(lastInvalid.status, 401);
    const blocked = await login("founder_01", "long-password-one");
    assert.equal(blocked.status, 429, "repeated sign-in attempts are rate-limited");
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
