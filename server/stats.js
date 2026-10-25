// Anonymous practice counters (Proof of Life). Stored in Postgres when available, else in memory.
// No transcripts, names or emails: visitors are a salted hash of a random browser id.
import { createHash } from "node:crypto";

export const EVENTS = ["visit", "coach_turn", "coach_start", "verdict", "showtime_start", "report", "retry", "agent_review", "camera_on", "transcribe"];
const today = () => new Date().toISOString().slice(0, 10);

export function createStats(db, salt = process.env.SESSION_SECRET || "clarity") {
  const mem = { since: new Date().toISOString(), events: {}, visitors: new Map() };
  let useDb = !!db, warned = false;
  const hash = sid => createHash("sha256").update(`${salt}:${sid}`).digest("hex");
  const memTrack = (type, sid) => {
    mem.events[type] = (mem.events[type] || 0) + 1;
    if (sid && !mem.visitors.has(sid)) mem.visitors.set(sid, today());
  };
  const dbFailed = error => {
    if (!warned) console.warn("Usage counters fell back to memory (run `npm run db:migrate`?):", error.code || error.message);
    warned = true; useDb = false;
  };
  async function track(type, sid) {
    if (!EVENTS.includes(type)) return;
    const validSid = typeof sid === "string" && /^[a-z0-9-]{8,40}$/i.test(sid) ? sid : null;
    if (!useDb) return memTrack(type, validSid);
    try {
      await db.query(`INSERT INTO clarity_event_counts(day,type,count) VALUES($1,$2,1)
        ON CONFLICT(day,type) DO UPDATE SET count = clarity_event_counts.count + 1`, [today(), type]);
      if (validSid) await db.query("INSERT INTO clarity_visitors(visitor_hash,first_day) VALUES($1,$2) ON CONFLICT DO NOTHING", [hash(validSid), today()]);
    } catch (error) { dbFailed(error); memTrack(type, validSid); }
  }
  async function summary() {
    if (useDb) {
      try {
        const [events, visitors, first] = await Promise.all([
          db.query("SELECT type, SUM(count)::bigint AS n FROM clarity_event_counts GROUP BY type"),
          db.query("SELECT first_day::text AS day, COUNT(*)::int AS n FROM clarity_visitors GROUP BY first_day ORDER BY first_day"),
          db.query("SELECT MIN(day)::text AS since FROM clarity_event_counts"),
        ]);
        const byDay = Object.fromEntries(visitors.rows.map(r => [r.day, r.n]));
        return { since: first.rows[0]?.since || today(), storage: "database",
          uniqueVisitors: visitors.rows.reduce((a, r) => a + r.n, 0), newVisitorsByDay: byDay,
          events: Object.fromEntries(events.rows.map(r => [r.type, Number(r.n)])) };
      } catch (error) { dbFailed(error); }
    }
    const byDay = {};
    for (const d of mem.visitors.values()) byDay[d] = (byDay[d] || 0) + 1;
    return { since: mem.since, storage: "memory", uniqueVisitors: mem.visitors.size, newVisitorsByDay: byDay, events: mem.events };
  }
  return { track: (type, sid) => { track(type, sid).catch(() => {}); }, summary };
}
