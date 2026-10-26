// Runs only when TEST_DATABASE_URL points at a disposable Postgres (it drops the app's tables first).
import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
const { ensureSchema, SCHEMA_VERSION } = await import("../server/db.js");

test("a brand-new database gets every table automatically, even with several instances starting at once", { skip: !url && "set TEST_DATABASE_URL to run" }, async () => {
  const admin = new pg.Pool({ connectionString: url });
  await admin.query(`DROP TABLE IF EXISTS clarity_schema_version, clarity_attempts, clarity_auth_sessions, clarity_auth_login_limits,
    clarity_auth_users, clarity_event_counts, clarity_visitors CASCADE`);
  const pools = [1, 2, 3].map(() => new pg.Pool({ connectionString: url }));
  try {
    const results = await Promise.all(pools.map(p => ensureSchema(p)));      // three cold starts at the same moment
    assert.ok(results.every(r => r.ok));
    assert.equal(results.filter(r => r.migrated).length, 1, "exactly one instance runs the migration");
    const tables = (await admin.query(`SELECT tablename FROM pg_tables WHERE tablename LIKE 'clarity_%' ORDER BY 1`)).rows.map(r => r.tablename);
    assert.deepEqual(tables, ["clarity_attempts", "clarity_auth_login_limits", "clarity_auth_sessions", "clarity_auth_users",
      "clarity_event_counts", "clarity_schema_version", "clarity_visitors"]);
    assert.equal((await admin.query("SELECT version FROM clarity_schema_version")).rows[0].version, SCHEMA_VERSION);
    const again = await ensureSchema(pools[0]);                               // later starts: one quick SELECT
    assert.deepEqual(again, { ok: true, migrated: false });
  } finally { await Promise.all([...pools, admin].map(p => p.end())); }
});

test("an existing database from the old manual setup is upgraded in place, keeping its data", { skip: !url && "set TEST_DATABASE_URL to run" }, async () => {
  const admin = new pg.Pool({ connectionString: url });
  try {
    await admin.query("DROP TABLE IF EXISTS clarity_schema_version");         // as if schema.sql was pasted by hand earlier
    await admin.query("INSERT INTO clarity_auth_users (id, username, password_hash) VALUES (gen_random_uuid(), 'keepme', 'scrypt$x') ON CONFLICT DO NOTHING");
    assert.equal((await ensureSchema(admin)).migrated, true);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM clarity_auth_users WHERE username = 'keepme'")).rows[0].n, 1);
  } finally { await admin.end(); }
});
