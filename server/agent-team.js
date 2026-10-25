// The Clarity AI agent team. Each report is produced by several specialised agents, some AI and some
// deterministic, coordinated by the server (the orchestrator). The manifest is public for transparency.
export const AGENT_TEAM = [
  { id: "scenario", name: "Scenario designer", kind: "llm", job: "Understands what you're preparing for, from your own words in any language, and builds the checklist, practice partner and time limit." },
  { id: "coach", name: "Warm-up coach", kind: "llm", job: "Coaches one point at a time by voice, tracks which checklist points you've covered and steers to the next." },
  { id: "persona", name: "Practice partner", kind: "llm+voice", job: "Plays the listener (an investor, hiring manager, client, examiner...) with an ElevenLabs or browser voice, and stays silent while you speak." },
  { id: "listener", name: "Speech listener", kind: "speech", job: "Turns speech into text: live browser recognition, or open-source Whisper for Safari and Firefox." },
  { id: "delivery", name: "Delivery analyst", kind: "deterministic", job: "Measures pace, fillers, hedges and pauses." },
  { id: "presence", name: "Presence analyst", kind: "on-device vision", job: "Estimates eye contact, posture, gestures and steadiness with MediaPipe, on your device; video is never uploaded." },
  { id: "judge", name: "Lead reviewer", kind: "llm", job: "Writes the full report: scores, checklist evidence, fixes, the hardest follow-up question and a rewrite." },
  { id: "evaluator", name: "Independent evaluator", kind: "llm", job: "Reviews the same transcript separately, with stricter evidence rules, and flags red flags." },
  { id: "referee", name: "Referee", kind: "deterministic", job: "Merges both reviews (averages scores, leans cautious on disagreements) and re-applies the scoring formula." },
  { id: "verifier", name: "Quote verifier", kind: "deterministic", job: "Checks that every quote in your report actually appears in your transcript, and labels anything paraphrased." },
  { id: "planner", name: "Practice planner", kind: "llm+tools", job: "Reads your history, finds recurring gaps and plans your next three drills." },
  { id: "drill", name: "Drill coach", kind: "llm", job: "Grades focused 60–90 second reps on one point." },
  { id: "followup", name: "Follow-up interviewer", kind: "llm", job: "Asks the toughest follow-up question and grades your answer." },
];

const norm = s => String(s || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
// True if the quote appears in the transcript, allowing for punctuation, case and small transcription drift.
export function quoteFound(quote, transcriptNorm) {
  const q = norm(quote);
  if (!q || q === "not mentioned") return null;
  if (transcriptNorm.includes(q)) return true;
  const words = q.split(" ");
  if (words.length < 4) return false;
  const shingles = [];
  for (let i = 0; i + 3 <= words.length; i++) shingles.push(words.slice(i, i + 3).join(" "));
  const hits = shingles.filter(s => transcriptNorm.includes(s)).length;
  return hits / shingles.length >= 0.6;
}

// Verifier agent: annotates quotes and returns counts for the trace.
export function verifyQuotes(report, transcript) {
  const t = norm(transcript);
  let checked = 0, ok = 0;
  const mark = (q) => { const f = quoteFound(q, t); if (f === null) return undefined; checked++; if (f) ok++; return f; };
  report.checklist = (report.checklist || []).map(c => ({ ...c, quoteVerified: mark(c.evidence) }));
  report.strengths = (report.strengths || []).map(s => ({ ...s, quoteVerified: mark(s.quote) }));
  report.fixes = (report.fixes || []).map(f => ({ ...f, quoteVerified: mark(f.youSaid) }));
  return { checked, ok };
}
