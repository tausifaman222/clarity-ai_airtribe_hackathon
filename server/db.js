// One shared Postgres pool. Works with Replit Postgres, Neon, Supabase or any Postgres URL.
// Vercel's Neon integration sets POSTGRES_URL / DATABASE_URL; either is accepted.
import pg from "pg";

const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
export const database = url
  ? new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, max: Number(process.env.PG_POOL_MAX || 5) })
  : null;
database?.on("error", error => console.error("Postgres pool error:", error.code || error.message));
