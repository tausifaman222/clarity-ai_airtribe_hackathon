import { randomUUID } from "node:crypto";
import { getAuth } from "@clerk/express";
import pg from "pg";

export const database = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 5 }) : null;

export const userIdOf = req => req.auth ? getAuth(req).userId : null;
const stages = new Set(["idea", "preseed", "seed", "seriesa"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only the judge route calls this. Clients can never supply a leaderboard score.
export async function saveVerifiedAttempt(db, userId, report, stage, inputMode) {
  if (!userId) return { ...report, leaderboardStatus: "sign_in_required" };
  if (!db) return { ...report, leaderboardStatus: "save_failed" };
  const id = randomUUID();
  try {
    await db.query(
      "INSERT INTO clarity_attempts(id,user_id,stage,input_mode,score,report) VALUES($1,$2,$3,$4,$5,$6)",
      [id, userId, stage, inputMode, report.overall, JSON.stringify(report)],
    );
    return { ...report, attemptId: id, leaderboardStatus: "private" };
  } catch (error) {
    console.error("Could not save verified practice score:", error.code || "database_error");
    return { ...report, leaderboardStatus: "save_failed" };
  }
}

export function registerCommunity(app, { db = database, identity = userIdOf } = {}) {
  const protectedRoute = (req, res, next) => {
    req.communityUserId = identity(req);
    if (!req.communityUserId) return res.status(401).json({ error: "Sign in with Google to manage your scores." });
    if (!db) return res.status(503).json({ error: "Score storage is unavailable. Please try again later." });
    next();
  };
  const sameOrigin = (req, res, next) => {
    const origin = req.get("origin");
    if (origin) {
      try {
        const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
        if (new URL(origin).host !== host) return res.status(403).json({ error: "Cross-site changes are not allowed." });
      } catch { return res.status(403).json({ error: "Invalid request origin." }); }
    }
    if (req.method !== "DELETE" && !req.is("application/json")) return res.status(415).json({ error: "Send JSON." });
    next();
  };
  const run = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      console.error("Community request failed:", error.code || "database_error");
      res.status(503).json({ error: "The leaderboard is temporarily unavailable. Your practice is unaffected." });
    }
  };

  app.get("/api/leaderboard", run(async (req, res) => {
    const stage = req.query.stage || "idea", input = req.query.input || "spoken";
    if (!stages.has(stage) || !["spoken", "typed"].includes(input)) return res.status(400).json({ error: "Choose a valid stage and spoken or typed practice." });
    if (!db) return res.status(503).json({ error: "The leaderboard is not connected to score storage yet." });
    const result = await db.query(`
      WITH best AS (
        SELECT DISTINCT ON (user_id) user_id, display_name, score, created_at
        FROM clarity_attempts WHERE published = TRUE AND stage = $1 AND input_mode = $2
        ORDER BY user_id, score DESC, created_at ASC, id ASC
      ), ranked AS (
        SELECT display_name, score, created_at, DENSE_RANK() OVER (ORDER BY score DESC) AS rank
        FROM best
      )
      SELECT display_name AS name, score, rank::int, created_at AS achieved_at
      FROM ranked ORDER BY score DESC, achieved_at ASC, name ASC LIMIT 50`, [stage, input]);
    res.set("Cache-Control", "no-store").json({ entries: result.rows, stage, input });
  }));

  app.get("/api/me/attempts", protectedRoute, run(async (req, res) => {
    const result = await db.query(`SELECT id,stage,input_mode,score,published,display_name,created_at
      FROM clarity_attempts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.communityUserId]);
    res.set("Cache-Control", "no-store").json({ attempts: result.rows });
  }));
  app.post("/api/leaderboard/publish", protectedRoute, sameOrigin, run(async (req, res) => {
    const { attemptId } = req.body || {};
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    if (!uuid.test(attemptId || "") || displayName.length < 2 || displayName.length > 40 || /[@\u0000-\u001f]/.test(displayName)) {
      return res.status(400).json({ error: "Choose a score and a public name of 2–40 characters. Don't use an email address." });
    }
    const result = await db.query(`UPDATE clarity_attempts SET published=TRUE,display_name=$1
      WHERE id=$2 AND user_id=$3 RETURNING id,stage,input_mode,score`, [displayName, attemptId, req.communityUserId]);
    if (!result.rows.length) return res.status(404).json({ error: "That verified score wasn't found in your account." });
    res.json({ published: true, attempt: result.rows[0] });
  }));
  app.delete("/api/leaderboard/entries", protectedRoute, sameOrigin, run(async (req, res) => {
    await db.query("UPDATE clarity_attempts SET published=FALSE,display_name=NULL WHERE user_id=$1", [req.communityUserId]);
    res.json({ removed: true });
  }));
}
