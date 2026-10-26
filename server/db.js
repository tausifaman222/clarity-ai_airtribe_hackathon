// One shared Postgres pool. Works with Replit Postgres, Neon, Supabase or any Postgres URL.
// Vercel's Neon integration sets POSTGRES_URL / DATABASE_URL; either is accepted.
import pg from "pg";
import { readFile } from "node:fs/promises";

const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
export const database = url
  ? new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, max: Number(process.env.PG_POOL_MAX || 5) })
  : null;
database?.on("error", error => console.error("Postgres pool error:", error.code || error.message));

// Bump when db/schema.sql changes, so every deployment applies it once.
export const SCHEMA_VERSION = 2;
const LOCK_ID = 727401; // any constant: serialises migrations when several instances start at once

// Creates or updates the tables automatically. Fast path: one SELECT when the schema is already current.
// The schema file is idempotent, and an advisory lock stops two cold starts from migrating at the same time.
export async function ensureSchema(db = database) {
  if (!db) return { ok: false, reason: "no database" };
  try {
    const r = await db.query("SELECT version FROM clarity_schema_version LIMIT 1");
    if (r.rows[0]?.version >= SCHEMA_VERSION) return { ok: true, migrated: false };
  } catch { /* table doesn't exist yet: first run */ }
  const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    const again = await client.query("SELECT to_regclass('clarity_schema_version') AS t");
    if (again.rows[0].t) {
      const v = await client.query("SELECT version FROM clarity_schema_version LIMIT 1");
      if (v.rows[0]?.version >= SCHEMA_VERSION) { await client.query("COMMIT"); return { ok: true, migrated: false }; }
    }
    await client.query(sql);
    await client.query("CREATE TABLE IF NOT EXISTS clarity_schema_version (version INTEGER NOT NULL)");
    await client.query("DELETE FROM clarity_schema_version");
    await client.query("INSERT INTO clarity_schema_version (version) VALUES ($1)", [SCHEMA_VERSION]);
    await client.query("COMMIT");
    console.log(`Database schema created/updated to v${SCHEMA_VERSION}.`);
    return { ok: true, migrated: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}
