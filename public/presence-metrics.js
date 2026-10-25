// Body-language metrics from MediaPipe face + pose landmarks. Pure functions, shared by the browser,
// the server (to validate what it receives) and the tests. Everything is computed on the device;
// only these summary numbers ever leave the browser.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ratio = (v, a, b) => (b - a === 0 ? 0.5 : (v - a) / (b - a));

// Face mesh indices (478-point model with irises).
const F = { nose: 1, top: 10, chin: 152, left: 234, right: 454, lOut: 33, lIn: 133, rIn: 362, rOut: 263, lIris: 468, rIris: 473 };
// Pose indices.
const P = { nose: 0, lShoulder: 11, rShoulder: 12, lWrist: 15, rWrist: 16 };

export function faceFeatures(lm, blendshapes) {
  if (!lm || lm.length < 468) return null;
  const yaw = ratio(lm[F.nose].x, lm[F.left].x, lm[F.right].x) - 0.5;          // 0 = facing the camera
  const pitch = ratio(lm[F.nose].y, lm[F.top].y, lm[F.chin].y);                 // ~0.5–0.6 when level
  let gaze = 0.5;
  if (lm.length >= 478) {
    // Both ratios run left-to-right in the image (33→133 and 362→263), so they move together with the eyes.
    const l = ratio(lm[F.lIris].x, lm[F.lOut].x, lm[F.lIn].x), r = ratio(lm[F.rIris].x, lm[F.rIn].x, lm[F.rOut].x);
    gaze = (l + r) / 2;                                                          // 0.5 = looking straight
  }
  const score = name => blendshapes?.find?.(c => c.categoryName === name)?.score ?? 0;
  const smile = (score("mouthSmileLeft") + score("mouthSmileRight")) / 2;
  const faceWidth = Math.abs(lm[F.right].x - lm[F.left].x);
  const eyeContact = Math.abs(yaw) < 0.12 && pitch > 0.32 && pitch < 0.75 && Math.abs(gaze - 0.5) < 0.16;
  return { yaw, pitch, gaze, smile, faceWidth, eyeContact, nose: { x: lm[F.nose].x, y: lm[F.nose].y } };
}

export function poseFeatures(lm) {
  if (!lm || lm.length < 17) return null;
  const ls = lm[P.lShoulder], rs = lm[P.rShoulder];
  const vis = p => (p?.visibility ?? 1);
  if (vis(ls) < 0.5 || vis(rs) < 0.5) return null;
  const shoulderWidth = Math.max(1e-3, dist(ls, rs));
  const tiltDeg = Math.abs(Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180 / Math.PI);
  const tilt = Math.min(tiltDeg, Math.abs(180 - tiltDeg));
  const neck = ((ls.y + rs.y) / 2 - lm[P.nose].y) / shoulderWidth;               // head height above shoulders
  const inFrame = p => vis(p) > 0.6 && p.y > 0 && p.y < 1 && p.x > 0 && p.x < 1;
  const wrists = [lm[P.lWrist], lm[P.rWrist]].filter(inFrame).map(p => ({ x: p.x / shoulderWidth, y: p.y / shoulderWidth }));
  return { tilt, neck, shoulderWidth, wrists };
}

// Accumulates frames and produces live nudges and a final summary.
export function createPresenceTracker({ now = () => Date.now() } = {}) {
  const t = { frames: 0, face: 0, eye: 0, smile: 0, pose: 0, posture: 0, hands: 0, motion: 0, motionFrames: 0, head: 0, headFrames: 0,
    neckBase: [], lastWrists: null, lastNose: null, recent: [], started: now(), lastNudge: -Infinity, nudgedAt: {} };
  const baseline = () => (t.neckBase.length >= 15 ? [...t.neckBase].sort((a, b) => a - b)[Math.floor(t.neckBase.length / 2)] : null);

  function add(face, pose) {
    t.frames++;
    const f = { face: !!face, eye: !!face?.eyeContact, smile: (face?.smile ?? 0) > 0.35, pose: !!pose, posture: null, hands: false, busy: false, still: true, jitter: false };
    if (face) {
      t.face++; if (f.eye) t.eye++; if (f.smile) t.smile++;
      if (t.lastNose) {
        const d = Math.hypot(face.nose.x - t.lastNose.x, face.nose.y - t.lastNose.y) / Math.max(0.05, face.faceWidth);
        t.head += d; t.headFrames++; f.jitter = d > 0.06;
      }
      t.lastNose = face.nose;
    } else t.lastNose = null;
    if (pose) {
      t.pose++;
      if (t.neckBase.length < 40 && pose.tilt < 8) t.neckBase.push(pose.neck);
      const base = baseline();
      const slouched = base != null && pose.neck < base * 0.78;
      f.posture = pose.tilt < 7 && !slouched; if (f.posture) t.posture++;
      f.hands = pose.wrists.length > 0; if (f.hands) t.hands++;
      if (t.lastWrists && pose.wrists.length) {
        const pairs = pose.wrists.map((w, i) => (t.lastWrists[i] ? Math.hypot(w.x - t.lastWrists[i].x, w.y - t.lastWrists[i].y) : 0));
        const m = Math.max(...pairs); t.motion += m; t.motionFrames++;
        f.busy = m > 0.35; f.still = m < 0.02;
      }
      t.lastWrists = pose.wrists.length ? pose.wrists : null;
    }
    t.recent.push({ at: now(), ...f });
    const cutoff = now() - 5000; while (t.recent.length && t.recent[0].at < cutoff) t.recent.shift();
  }

  // One gentle, visual nudge at most every 8 s; each kind at most every 25 s.
  function nudge() {
    const r = t.recent, n = r.length, at = now();
    if (n < 15 || at - t.lastNudge < 8000) return null;
    const share = key => r.filter(x => x[key]).length / n;
    const withPose = r.filter(x => x.pose), postureBad = withPose.length > n / 2 && withPose.filter(x => x.posture === false).length / withPose.length > 0.6;
    const candidates = [
      ["frame", share("face") < 0.4, "Move into the frame so your face is visible."],
      ["eyes", share("face") >= 0.4 && share("eye") < 0.35, "Look at the camera: it's your listener's eyes."],
      ["posture", postureBad, "Sit or stand tall, shoulders level."],
      ["busy", withPose.length > n / 2 && share("busy") > 0.3, "Slow your hands down; let gestures land."],
      ["steady", share("jitter") > 0.35, "Keep your head steady while you make a point."],
      ["hands", at - t.started > 45000 && t.pose > 30 && t.hands / t.pose < 0.08 && withPose.length > n / 2 && share("hands") === 0, "Let your hands show; open gestures build trust."],
      ["smile", at - t.started > 60000 && t.face > 100 && t.smile / t.face < 0.03, "A small smile makes you sound warmer."],
    ];
    for (const [kind, hit, text] of candidates) {
      if (hit && at - (t.nudgedAt[kind] ?? -Infinity) > 25000) { t.lastNudge = at; t.nudgedAt[kind] = at; return { kind, text }; }
    }
    return null;
  }

  function summary() {
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
    const sampledSec = Math.round((now() - t.started) / 1000);
    if (t.frames < 20) return null;
    const avgMotion = t.motionFrames ? t.motion / t.motionFrames : 0;
    const gestureLevel = !t.pose || t.hands / t.pose < 0.1 ? "hidden" : avgMotion < 0.03 ? "still" : avgMotion > 0.25 ? "busy" : "natural";
    const s = {
      sampledSec, frames: t.frames,
      facePresentPct: pct(t.face, t.frames),
      eyeContactPct: pct(t.eye, t.face),
      smilePct: pct(t.smile, t.face),
      posturePct: pct(t.posture, t.pose),
      handsVisiblePct: pct(t.hands, t.pose),
      gestureLevel,
      headSteadinessPct: t.headFrames ? clamp(Math.round(100 - (t.head / t.headFrames) * 900), 0, 100) : null,
    };
    s.score = presenceScore(s);
    s.tips = presenceTips(s);
    return s;
  }
  return { add, nudge, summary, _t: t };
}

export function presenceScore(s) {
  const part = (v, fallback = 0.6) => (v == null ? fallback : v / 100);
  const gesture = { natural: 1, still: 0.6, busy: 0.45, hidden: 0.4 }[s.gestureLevel] ?? 0.6;
  const framing = part(s.facePresentPct, 0);
  const raw = 0.35 * part(s.eyeContactPct) + 0.25 * part(s.posturePct) + 0.2 * gesture + 0.1 * Math.min(1, part(s.smilePct, 0.2) * 3) + 0.1 * part(s.headSteadinessPct);
  return Math.round(raw * Math.min(1, framing * 1.25) * 100) / 10;
}

export function presenceTips(s) {
  const tips = [];
  if ((s.facePresentPct ?? 0) < 60) tips.push({ title: "Stay in the frame", how: "Set the camera at eye level, about an arm's length away, so your face and shoulders stay visible." });
  if (s.eyeContactPct != null && s.eyeContactPct < 55) tips.push({ title: "Make more eye contact", how: "Look into the lens when you make your key points: the problem, your proof, and your ask. Glance at notes between points, not during them." });
  if (s.posturePct != null && s.posturePct < 60) tips.push({ title: "Open, upright posture", how: "Sit back with both feet on the floor, shoulders level and relaxed. It helps your voice carry, too." });
  if (s.gestureLevel === "hidden" || s.gestureLevel === "still") tips.push({ title: "Use your hands", how: "Keep your hands visible above the desk and use one simple gesture per point, such as counting on your fingers or opening your palms." });
  if (s.gestureLevel === "busy") tips.push({ title: "Calm your gestures", how: "Hold still at the end of each sentence. Fewer, slower gestures look more confident than constant movement." });
  if (s.headSteadinessPct != null && s.headSteadinessPct < 60) tips.push({ title: "Keep your head steady", how: "Pause briefly before important lines and keep your head still while you say them." });
  if (s.smilePct != null && s.smilePct < 5) tips.push({ title: "Let some warmth show", how: "Smile when you introduce yourself and when you talk about your users; it signals energy and belief." });
  return tips.slice(0, 3);
}

// Server-side validation: accept only bounded numbers and known labels.
export function cleanPresence(p) {
  if (!p || typeof p !== "object") return null;
  const n = (v, lo = 0, hi = 100) => (v == null || !Number.isFinite(Number(v)) ? null : clamp(Math.round(Number(v)), lo, hi));
  const out = {
    sampledSec: n(p.sampledSec, 0, 3600), facePresentPct: n(p.facePresentPct), eyeContactPct: n(p.eyeContactPct), smilePct: n(p.smilePct),
    posturePct: n(p.posturePct), handsVisiblePct: n(p.handsVisiblePct), headSteadinessPct: n(p.headSteadinessPct),
    gestureLevel: ["natural", "still", "busy", "hidden"].includes(p.gestureLevel) ? p.gestureLevel : null,
  };
  if (!out.sampledSec || out.facePresentPct == null) return null;
  out.score = presenceScore(out);
  out.tips = presenceTips(out);
  return out;
}
