import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { registerCommunity, saveVerifiedAttempt } from "../server/community.js";

test("verified-score ownership, opt-in publishing, best scores, ties, filters and removal", async () => {
  // A disposable, real PostgreSQL engine. No live database rows or provider calls.
  const db = new PGlite();
  await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const app = express();
  app.use(express.json());
  // Test-only identity injection is confined to this isolated test application.
  registerCommunity(app, { db, identity: req => req.get("x-test-user") || null });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { user, body, method = body ? "POST" : "GET", externalOrigin } = {}) => {
    const response = await fetch(origin + path, {
      method, headers: { ...(user ? { "x-test-user": user } : {}), "content-type": "application/json", ...(externalOrigin ? { origin: externalOrigin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  const save = (user, score, stage = "seed", input = "spoken") => saveVerifiedAttempt(db, user, { overall: score, privateFeedback: "Must never be public" }, stage, input);
  const publish = (user, attempt, displayName) => request("/api/leaderboard/publish", { user, body: { attemptId: attempt.attemptId, displayName, score: 100 } });
  const board = () => request("/api/leaderboard?stage=seed&input=spoken");
  try {
    const a = await save("alice", 82);
    assert.equal(a.leaderboardStatus, "private");
    assert.equal((await board()).body.entries.length, 0, "private by default");
    assert.equal((await publish(null, a, "Alice")).status, 401);
    assert.equal((await publish("bob", a, "Not mine")).status, 404);
    assert.equal((await publish("alice", a, "email@example.com")).status, 400);
    assert.equal((await request("/api/leaderboard/publish", { user: "alice", externalOrigin: "https://other.example", body: { attemptId: a.attemptId, displayName: "Alice" } })).status, 403);
    assert.equal((await publish("alice", a, "Alice")).status, 200);
    assert.equal((await publish("alice", a, "Alice")).status, 200, "publishing is idempotent");
    const aLow = await save("alice", 60);
    await publish("alice", aLow, "Alice");
    const b = await save("bob", 82); await publish("bob", b, "Bob");
    const c = await save("charlie", 90); await publish("charlie", c, "Charlie");
    const typed = await save("typed-user", 100, "seed", "typed"); await publish("typed-user", typed, "Typed");
    const idea = await save("idea-user", 99, "idea"); await publish("idea-user", idea, "Idea");
    const rankings = (await board()).body.entries;
    assert.deepEqual(rankings.map(entry => [entry.name, entry.score, entry.rank]), [["Charlie", 90, 1], ["Alice", 82, 2], ["Bob", 82, 2]]);
    assert.ok(rankings.every(entry => !("user_id" in entry) && !("report" in entry) && !("email" in entry)));
    assert.equal((await request("/api/leaderboard?stage=seed&input=typed")).body.entries.length, 1);
    assert.equal((await request("/api/leaderboard?stage=invalid")).status, 400);
    assert.equal((await request("/api/me/attempts")).status, 401);
    assert.equal((await request("/api/me/attempts", { user: "alice" })).body.attempts.length, 2);
    assert.equal((await request("/api/leaderboard/entries", { user: "alice", method: "DELETE" })).status, 200);
    assert.deepEqual((await board()).body.entries.map(entry => entry.name), ["Charlie", "Bob"]);
    assert.equal((await saveVerifiedAttempt(db, null, { overall: 80 }, "seed", "typed")).leaderboardStatus, "sign_in_required");
    assert.equal((await saveVerifiedAttempt(null, "alice", { overall: 80 }, "seed", "typed")).leaderboardStatus, "save_failed");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
