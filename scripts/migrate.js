// Applies db/schema.sql to DATABASE_URL (or POSTGRES_URL). Safe to run repeatedly.
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error("Set DATABASE_URL (or POSTGRES_URL) first."); process.exit(1); }
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("Database schema is up to date.");
} finally { await client.end(); }
