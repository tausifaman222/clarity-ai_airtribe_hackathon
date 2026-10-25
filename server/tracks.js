// Practice "tracks": a startup-pitch stage or a custom scenario. Shared by the API routes and the agents.
import { stageById } from "../public/rubrics.js";
import { normalizeScenario, scenarioTrack } from "../public/scenarios.js";
import { PITCH_SECONDS } from "../public/practice-config.js";
import { registerKeywords } from "../offline.js";

const str = (v, max = 4000) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, max);

// A "track" is either a startup-pitch stage (STAGES) or a custom scenario (job interview, negotiation, ...).
export function trackFrom(body) {
  if (str(body?.stage, 20) === "custom") {
    const sc = normalizeScenario(body?.scenario);
    if (!sc) return null;
    registerKeywords(sc.items);
    return scenarioTrack(sc);
  }
  return stageById(str(body?.stage, 20));
}
// Wording that changes between startup pitches and other scenarios.
export function ctxOf(t) {
  if (!t.custom) return { pitch: true, what: `${t.name}-stage startup pitch`, speaker: "founder", listener: "an experienced early-stage investor",
    persona: "Meera Kapoor, a fictional AI investor", label: `${t.name} CHECKLIST`, limitSec: PITCH_SECONDS };
  const sc = t.scenario;
  return { pitch: false, what: sc.name, speaker: "speaker", listener: sc.audience, persona: `${sc.personaName}, a fictional AI ${sc.personaRole}`,
    label: "SCENARIO CHECKLIST", limitSec: sc.timeLimitSec, goal: sc.goal };
}
