// Clarity AI practice client: hash-routed SPA with tab-local drafts.
// Clerk authenticates accounts; verified leaderboard scores are stored server-side.
import { STAGES, stageById, PRO_TIPS, FILLERS, HEDGES, wordCount, DEMO_PITCH } from "./rubrics.js";
import { icon } from "./icons.js";
import { renderHome } from "./home.js";
import { renderLeaderboard, mountPublishPanel } from "./leaderboard.js";
import { PITCH_SECONDS, FINAL_COUNTDOWN_SECONDS } from "./practice-config.js";
import { addReportGuidance } from "./pitch-guidance.js";
import { improvementPlanHTML } from "./report-plan.js";

// ---------- utilities ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fmt = (sec) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, Math.round(sec)) % 60).padStart(2, "0")}`;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const COACH_OPENER = "Let's work on your idea together. What are you building, who is it for, and what problem does it solve? It's okay if you're still figuring parts out. Start with what you know.";
const MEERA_INTRO = "Hi, I'm Meera, your AI practice partner. Tell me what you're building, who it's for, and why it matters. Take your time. You have up to five minutes.";
const STORE = "sayso.v1";

let SID = "anon";
try { SID = localStorage.getItem("sayso.sid") || (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()); localStorage.setItem("sayso.sid", SID); } catch {}

const S = { stage: null, micLang: "en-IN", coach: null, show: null, report: null, demo: false };
try { Object.assign(S, JSON.parse(sessionStorage.getItem(STORE) || "{}")); } catch {}
function save() { try { sessionStorage.setItem(STORE, JSON.stringify(S)); } catch {} }

function toast(msg, kind = "") {
  const t = $("#toast"); t.textContent = msg; t.className = `toast show ${kind}`;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = "toast"; }, 3200);
}
function track(type) {
  try { fetch("/api/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, sid: SID }), keepalive: true }); } catch {}
}
async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  } catch { const e = new Error("You seem to be offline. Check your connection."); e.network = true; throw e; }
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(data?.message || data?.error || `Error ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}
// LLM routes: on a server or network error, show the toast and auto-retry once.
async function callWithRetry(path, body) {
  try { return await api(path, body); } catch (e) {
    if (e.status && e.status < 500) throw e;
    toast("We couldn't connect to feedback. Trying once more…");
    await sleep(1200);
    return await api(path, body);
  }
}

// ---------- text-to-speech ----------
// ElevenLabs (via our server, key stays server-side) when configured; otherwise, or on any failure,
// the browser's speechSynthesis at rate 1.05 with an en-IN or hi-IN voice.
let TTS_MODE = "browser";
let HEALTH_V = {};
const tts = {
  voices: [], token: 0, done: null, audio: null, cache: new Map(),
  async fetchAudio(text, who) {
    const key = `${who}|${text}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, voice: who }) });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    this.cache.set(key, url);
    if (this.cache.size > 24) { const [k, u] = this.cache.entries().next().value; this.cache.delete(k); URL.revokeObjectURL(u); }
    return url;
  },
  prefetch(text, who) { if (TTS_MODE === "elevenlabs") this.fetchAudio(text, who).catch(() => {}); },
  async speak(text, who = "coach") {
    if (TTS_MODE !== "elevenlabs" || !text) return this.speakBrowser(text);
    this.stop();
    const my = this.token;
    try {
      const url = await this.fetchAudio(String(text).slice(0, 1200), who);
      if (my !== this.token) return;
      await new Promise((resolve, reject) => {
        const a = this.audio = new Audio(url); this.done = resolve;
        a.onended = () => { this.done = null; resolve(); };
        a.onerror = () => reject(new Error("audio"));
        a.play().catch(reject);
      });
    } catch {
      if (my === this.token) return this.speakBrowser(text); // fall back to the browser voice
    }
  },
  init() {
    if (!window.speechSynthesis) return;
    const load = () => { this.voices = speechSynthesis.getVoices() || []; };
    load(); speechSynthesis.addEventListener?.("voiceschanged", load);
  },
  isHindi: (t) => (String(t).match(/[ऀ-ॿ]/g) || []).length > String(t).replace(/\s/g, "").length * 0.5,
  pick(text) {
    const v = this.voices, norm = (l) => (l || "").replace("_", "-").toLowerCase();
    if (this.isHindi(text)) return v.find(x => norm(x.lang) === "hi-in") || v.find(x => norm(x.lang).startsWith("hi"));
    return v.find(x => norm(x.lang) === "en-in") || v.find(x => norm(x.lang) === "en-gb") || v.find(x => norm(x.lang).startsWith("en"));
  },
  speakBrowser(text) {
    this.stop();
    return new Promise(resolve => {
      if (!window.speechSynthesis || !text) return resolve();
      const my = ++this.token; this.done = resolve;
      const parts = String(text).match(/[^.!?।]+[.!?।]*\s*/g) || [String(text)];
      const chunks = []; for (const p of parts) { if (chunks.length && (chunks[chunks.length - 1] + p).length < 180) chunks[chunks.length - 1] += p; else chunks.push(p); }
      const voice = this.pick(text), hindi = this.isHindi(text);
      let i = 0;
      const next = () => {
        if (my !== this.token) return;
        if (i >= chunks.length) { this.done = null; return resolve(); }
        const u = new SpeechSynthesisUtterance(chunks[i++].trim());
        u.rate = 1.05; u.lang = voice?.lang || (hindi ? "hi-IN" : "en-IN"); if (voice) u.voice = voice;
        let fin = false; const end = () => { if (fin) return; fin = true; clearTimeout(guard); next(); };
        const guard = setTimeout(end, 3000 + u.text.length * 110); // some browsers never fire onend
        u.onend = end; u.onerror = end;
        speechSynthesis.speak(u);
      };
      next();
    });
  },
  stop() {
    this.token++;
    try { window.speechSynthesis?.cancel(); } catch {}
    try { if (this.audio) { this.audio.pause(); this.audio = null; } } catch {}
    const d = this.done; this.done = null; d?.();
  },
};
tts.init();

// ---------- speech-to-text (webkitSpeechRecognition) + mic level (Web Audio AnalyserNode) ----------
class Mic {
  constructor(o) { this.o = o; this.on = false; this.level = 0; }
  async start(lang) {
    if (!SR) throw new Error("unsupported");
    if (this.on) return;
    this.on = true; this.segStart = null;
    if (!IS_ANDROID && navigator.mediaDevices?.getUserMedia) {
      try { await this.startLevel(); } catch (e) {
        this.on = false;
        if (e?.name === "NotAllowedError" || e?.name === "SecurityError") throw new Error("denied");
        if (e?.name === "NotFoundError") throw new Error("nomic");
      }
      if (!this.on) { this.stop(); return; }
    }
    const rec = this.rec = new SR();
    rec.lang = lang || "en-IN"; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const now = Date.now(); let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], text = r[0]?.transcript || "";
        if (r.isFinal) { if (text.trim()) this.o.onFinal?.({ text: text.trim(), start: this.segStart ?? now, end: now }); this.segStart = null; }
        else { if (this.segStart == null) this.segStart = now; interim += text; }
      }
      this.o.onInterim?.(interim.trim());
      if (IS_ANDROID) this.o.onLevel?.(0.6);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { this.stop(); this.o.onError?.("denied"); }
      else if (e.error === "audio-capture") { this.stop(); this.o.onError?.("nomic"); }
      else if (e.error === "network") { this.stop(); this.o.onError?.("network"); }
    };
    rec.onend = () => { if (this.on && this.rec === rec) { try { rec.start(); } catch { this.stop(); this.o.onError?.("ended"); } } };
    try { rec.start(); } catch { /* already started */ }
  }
  async startLevel() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    this.ctx = new Ctx(); const src = this.ctx.createMediaStreamSource(this.stream);
    const an = this.ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      if (!this.ctx) return;
      an.getByteTimeDomainData(buf); let s = 0;
      for (const v of buf) { const x = (v - 128) / 128; s += x * x; }
      this.level = this.level * 0.65 + Math.min(1, Math.sqrt(s / buf.length) * 5) * 0.35;
      this.o.onLevel?.(this.level);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  stop() {
    this.on = false;
    const rec = this.rec; this.rec = null;
    try { rec?.stop(); } catch {}
    cancelAnimationFrame(this.raf);
    try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
    try { this.ctx?.close(); } catch {}
    this.stream = null; this.ctx = null; this.level = 0;
    this.o.onLevel?.(0);
  }
}

// ---------- router, stepper, overlay ----------
const STEPS = [["Practice", "/"], ["Your stage", "/stage"], ["Practice style", "/mode"], ["Rehearse", null], ["Feedback", null]];
const STEP_OF = { "/": 0, "/stage": 1, "/mode": 2, "/coach": 3, "/briefing": 3, "/showtime": 3, "/report": 4, "/stats": 0 };
let cleanups = [];
const onLeave = (fn) => cleanups.push(fn);
const go = (p) => { if (location.hash === "#" + p) router(); else location.hash = "#" + p; };

function renderStepper(n) {
  $("#stepper").innerHTML = STEPS.map(([lbl, href], i) => {
    const cls = i < n ? "done" : i === n ? "now" : "";
    const inner = `<span class="dot">${i < n ? icon("check", 11) : i + 1}</span><span class="lbl">${lbl}</span>`;
    const line = i ? `<span class="step-line ${i <= n ? "done" : ""}"></span>` : "";
    return line + (href && i < n ? `<a class="step ${cls}" href="#${href}">${inner}</a>` : `<span class="step ${cls}" ${i === n ? 'aria-current="step"' : ""}>${inner}</span>`);
  }).join("");
}
function closeOverlay() { $("#overlay").innerHTML = ""; }
function openModal(html, onClose) {
  const ov = $("#overlay");
  ov.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const bg = $(".modal-bg", ov);
  const close = () => { document.removeEventListener("keydown", key); closeOverlay(); onClose?.(); };
  const key = (e) => { if (e.key === "Escape") close(); };
  bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
  document.addEventListener("keydown", key);
  setTimeout(() => $("button, [href]", ov)?.focus(), 30);
  return { el: $(".modal", ov), close };
}

function router() {
  cleanups.forEach(f => { try { f(); } catch {} }); cleanups = [];
  tts.stop(); closeOverlay();
  const p = (location.hash.replace(/^#/, "").split("?")[0]) || "/";
  const view = ROUTES[p] || home;
  document.body.classList.toggle("home-page", view === home);
  renderStepper(STEP_OF[p] ?? 0);
  const v = $("#view"); v.innerHTML = "";
  const root = document.createElement("div"); root.className = "view"; v.append(root);
  window.scrollTo(0, 0);
  view(root);
  document.dispatchEvent(new Event("clarity:route"));
}

// Tooltips: hover/focus on desktop, tap to toggle on touch.
document.addEventListener("click", (e) => {
  const b = e.target.closest(".tipbtn");
  $$(".tipwrap.open").forEach(w => { if (!b || w !== b.parentElement) w.classList.remove("open"); });
  if (b) { e.preventDefault(); e.stopPropagation(); b.parentElement.classList.toggle("open"); }
}, true);
const tip = (title, bodyHtml, left = false) =>
  `<span class="tipwrap"><button type="button" class="tipbtn" aria-label="${esc(title)}">${icon("info", 16)}</button><span class="pop ${left ? "left" : ""}" role="tooltip"><b>${esc(title)}</b>${bodyHtml}</span></span>`;

function langToggle() {
  return `<div class="seg" role="group" aria-label="Mic language">
    <button type="button" data-lang="en-IN" aria-pressed="${S.micLang !== "hi-IN"}">English / Hinglish (en-IN)</button>
    <button type="button" data-lang="hi-IN" aria-pressed="${S.micLang === "hi-IN"}">हिंदी (hi-IN)</button></div>`;
}
function bindLang(root, onChange) {
  $$(".seg [data-lang]", root).forEach(b => b.addEventListener("click", () => {
    S.micLang = b.dataset.lang; save();
    $$(".seg [data-lang]", root).forEach(x => x.setAttribute("aria-pressed", String(x.dataset.lang === S.micLang)));
    onChange?.();
  }));
}
const noVoiceBanner = () => SR ? "" : `<div class="banner" role="note">${icon("alert", 16)} Voice works best in Chrome. You can still type your pitch below.</div>`;
const deniedCard = () => `<div class="denied" role="alert"><b>${icon("micOff", 16)} We can't hear you yet: microphone access is blocked.</b>
  <ol><li>Click the lock or site-settings icon at the left of the address bar.</li><li>Set <b style="display:inline">Microphone</b> to Allow.</li><li>Come back here and tap Retry.</li></ol>
  <div class="row"><button class="btn sm primary" data-retry-mic>${icon("retry", 14)} Retry</button><span class="small muted">Or type instead, below.</span></div></div>`;

// ======================= SCREEN 1: HOME =======================
function home(root) {
  renderHome(root, { icon, stages: STAGES, state: S, save, navigate: go, health: HEALTH, onLeave });
}

// ======================= SCREEN 2: STAGE =======================
function stageView(root) {
  let picked = S.stage;
  root.innerHTML = `
  <div class="head center"><h2>Where are you with your idea?</h2>
    <p>Choose the closest match. Your feedback will reflect your current stage—not what a more mature company should have.</p></div>
  <div class="grid g2" role="radiogroup" aria-label="Startup stage">
    ${STAGES.map(s => `
    <div class="card hover stage-card ${picked === s.id ? "active" : ""}" role="radio" tabindex="0" aria-checked="${picked === s.id}" data-stage="${s.id}">
      <div class="row"><span class="radio"></span><h3>${esc(s.name)}</h3><span class="spacer"></span>
        ${tip(`What does a great ${s.name} pitch cover?`, `<ol>${s.items.map(i => `<li>${esc(i.title)}${i.must ? ' <span class="must">★</span>' : ""}</li>`).join("")}</ol>`)}</div>
      <p>${esc(s.oneLiner)}</p>
      <p class="want"><b>Focus on:</b> ${esc(s.wants)}</p>
    </div>`).join("")}
  </div>
  <div class="actions"><button class="btn primary lg" id="cont" ${picked ? "" : "disabled"}>Continue ${icon("arrowRight", 16)}</button></div>`;
  const pick = (id) => {
    picked = id;
    $$(".stage-card", root).forEach(c => { const on = c.dataset.stage === id; c.classList.toggle("active", on); c.setAttribute("aria-checked", String(on)); });
    $("#cont", root).disabled = false;
  };
  $$(".stage-card", root).forEach(c => {
    c.addEventListener("click", () => pick(c.dataset.stage));
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c.dataset.stage); } });
  });
  $("#cont", root).addEventListener("click", () => { if (!picked) return; S.stage = picked; save(); go("/mode"); });
}

// ======================= SCREEN 3: MODE =======================
function modeView(root) {
  const stage = stageById(S.stage); if (!stage) return go("/stage");
  const li = (t) => `<li>${icon("check", 16)} ${esc(t)}</li>`;
  root.innerHTML = `
  <div class="head center"><h2>What would help you most today?</h2>
    <p>Your stage: <b style="color:var(--text)">${esc(stage.name)}</b> · <a href="#/stage" class="linkbtn">Change</a></p></div>
  <div class="grid g2">
    <div class="card hover mode-card">
      <div class="emoji" aria-hidden="true">🧑‍🏫</div>
      <div><div class="small muted" style="font-weight:600">Coach</div><h3 style="font-size:22px">Rehearse with a coach</h3></div>
      <p class="muted">Still shaping the idea? Talk or type it through with your AI coach. Work on one point at a time, ask questions, and make your explanation clearer.</p>
      <ul>${li("Feedback after each turn")}${li("A checklist suited to your stage")}${li("No time limit; stop and resume when you need")}</ul>
      <button class="btn primary lg" id="goCoach">Start coaching</button>
    </div>
    <div class="card hover mode-card">
      <div class="emoji" aria-hidden="true">🎤</div>
      <div><div class="small muted" style="font-weight:600">Showtime</div><h3 style="font-size:22px">Practise your full pitch</h3></div>
      <p class="muted">Ready to explain it from start to finish? Rehearse without interruptions, then see what was clear, what was missing, and how to improve it.</p>
      <ul>${li("Up to five minutes, at your own pace")}${li("A quiet reminder in the final 45 seconds")}${li("Specific next steps for every missing or unclear point")}</ul>
      <button class="btn primary lg" id="goShow">Enter Showtime</button>
    </div>
  </div>
  <p class="helper">Not sure where to start? Choose Coach to shape your story. Use Showtime whenever you want to practise the whole explanation.</p>`;
  $("#goCoach", root).addEventListener("click", () => go("/coach"));
  $("#goShow", root).addEventListener("click", () => go("/briefing"));
}

function checklistHtml(stage, covered = [], focus = null, opts = {}) {
  return `<ul class="checklist ${opts.cls || ""}">${stage.items.map(i => `
    <li class="ck ${covered.includes(i.id) ? "on" : ""} ${focus === i.id ? "focus" : ""}" data-ck="${i.id}">
      <span class="box">${icon("check", 13)}</span>
      <span class="name">${esc(i.title)}${i.must ? ' <span class="must" title="Must-have">★</span>' : ""}</span>
      ${tip(i.title, `<span>${esc(i.good)}</span>`)}
    </li>`).join("")}</ul>`;
}

// ======================= SCREEN 4: COACH ROOM =======================
function coachView(root) {
  S.lastPractice = "coach";
  const stage = stageById(S.stage); if (!stage) return go("/stage");
  if (!S.coach || S.coach.stage !== stage.id) S.coach = { stage: stage.id, history: [], covered: [], nextFocus: null };
  const C = S.coach;
  let alive = true, status = "idle", handsFree = false, sending = false, finals = "", interim = "", silence = null;
  let paused = !!C.paused;
  onLeave(() => {
    C.paused = true;
    C.draft = [$("#typeIn", root)?.value, finals, interim].filter(Boolean).join(" ").slice(0, 2000);
    save(); alive = false; clearTimeout(silence); mic.stop();
  });

  root.innerHTML = `
  <div class="practice-toolbar" aria-label="Practice controls">
    <p id="practiceStatus" role="status">Your conversation is saved in this tab.</p>
    <button class="btn sm" id="stopPractice">Stop</button>
    <button class="btn sm primary" id="resumePractice">Resume</button>
    <button class="btn sm" id="resetPractice">Reset</button>
  </div>
  <div class="room">
    <section class="card convo" aria-label="Conversation with your coach">
      <div class="convo-head">
        <div class="avatar coach" id="coachAv">AC</div>
        <div><div style="font-weight:600">Your AI pitch coach</div><span class="status" id="status">Ready</span></div>
        <span class="spacer"></span>
        <span class="progress-chip" id="prog"></span>
        <button class="btn primary sm" id="verdictBtn" disabled title="Share at least two messages to get a useful readiness check">Check pitch readiness</button>
      </div>
      ${noVoiceBanner()}
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <div class="dock">
        <div class="interim" id="interim" aria-live="off"></div>
        <div id="micArea" style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%">
          <button class="mic" id="mic" aria-label="Tap to talk">${icon("mic", 32)}</button>
          <div class="hint">Tap to talk, tap again to send · auto-sends after a pause · <kbd>Space</kbd></div>
        </div>
        <form class="typebox" id="typeForm" autocomplete="off">
          <input id="typeIn" type="text" placeholder="Type instead…" aria-label="Type instead" maxlength="2000">
          <button class="btn" type="submit" aria-label="Send">${icon("send", 16)}</button>
        </form>
        ${langToggle()}
      </div>
    </section>
    <aside class="card guide" aria-label="Checklist">
      <h3>Your ${esc(stage.name)} pitch checklist</h3>
      <p class="small muted" style="margin-top:8px">Use this as a guide, not a script. Start with what you know and be clear about what you're still testing.</p>
      <div id="ckWrap">${checklistHtml(stage, C.covered, C.nextFocus)}</div>
      <div class="protips"><b>Pro tips</b>${esc(PRO_TIPS)}</div>
    </aside>
  </div>`;

  const msgsEl = $("#msgs", root), micBtn = $("#mic", root), interimEl = $("#interim", root), statusEl = $("#status", root), av = $("#coachAv", root);
  const mic = new Mic({
    onFinal: (seg) => { finals = `${finals} ${seg.text}`.trim(); showInterim(); bump(); },
    onInterim: (t) => { interim = t; showInterim(); if (t) bump(); },
    onLevel: (l) => micBtn.style.setProperty("--level", l.toFixed(3)),
    onError: (err) => { setStatus("idle"); micOff(); handleMicError(err); },
  });

  function setStatus(s) {
    status = s;
    statusEl.className = `status ${s}`;
    statusEl.textContent = { idle: "Ready", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…" }[s];
    av.className = `avatar coach ${s === "speaking" ? "speaking" : s === "thinking" ? "thinking" : ""}`;
    updateVerdictBtn();
  }
  function micOn() { micBtn.classList.add("on"); micBtn.setAttribute("aria-label", "Tap to send"); }
  function micOff() { micBtn.classList.remove("on"); micBtn.setAttribute("aria-label", "Tap to talk"); }
  function showInterim() { interimEl.textContent = `${finals} ${interim}`.trim(); }
  function bump() {
    clearTimeout(silence);
    silence = setTimeout(() => { const t = `${finals} ${interim}`.trim(); if (mic.on && t) send(t, true); }, 2500);
  }
  function handleMicError(err) {
    if (err === "denied") { $("#micArea", root).innerHTML = deniedCard(); $("[data-retry-mic]", root).addEventListener("click", () => router()); }
    else if (err === "nomic") toast("No microphone found. You can type instead.", "err");
    else if (err === "network") toast("Speech recognition needs an internet connection. You can type instead.", "err");
    else if (err === "unsupported") { toast("Voice works best in Chrome. You can still type your pitch below."); $("#typeIn", root).focus(); }
  }
  async function startListening() {
    if (!alive) return;
    if (!SR) return handleMicError("unsupported");
    tts.stop(); finals = ""; interim = ""; showInterim();
    setStatus("listening"); micOn();
    try { await mic.start(S.micLang); } catch (e) { setStatus("idle"); micOff(); handleMicError(e.message); }
  }
  function stopListening() { clearTimeout(silence); mic.stop(); micOff(); if (status === "listening") setStatus("idle"); }

  function renderMsgs(thinking = false) {
    msgsEl.innerHTML = C.history.map((m, i) => m.role === "coach"
      ? `<div class="msg coach"><div class="avatar coach">AC</div><div class="bubble">${esc(m.text)}</div><button class="iconbtn replay" data-replay="${i}" aria-label="Replay">${icon("volume", 16)}</button></div>`
      : `<div class="msg user ${m.failed ? "failed" : ""}"><div><div class="bubble">${esc(m.text)}</div>${m.failed ? `<div class="err">Not sent. <button class="linkbtn" data-resend>Retry</button></div>` : ""}</div></div>`
    ).join("") + (thinking ? `<div class="msg coach"><div class="avatar coach thinking">AC</div><div class="shimmer" aria-label="Coach is thinking"></div></div>` : "");
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function renderChecklist(fresh = []) {
    $("#ckWrap", root).innerHTML = checklistHtml(stage, C.covered, C.nextFocus);
    fresh.forEach(id => $(`[data-ck="${id}"]`, root)?.classList.add("pop-in"));
    $("#prog", root).textContent = `✓ ${C.covered.length}/${stage.items.length} covered`;
  }
  function userTurns() { return C.history.filter(m => m.role === "user" && !m.failed).length; }
  function updateVerdictBtn() { const b = $("#verdictBtn", root); if (b) b.disabled = userTurns() < 2 || sending; }

  async function speakCoach(text) {
    if (!alive || paused) return;
    setStatus("speaking");
    await tts.speak(text, "coach");
    if (!alive || status !== "speaking") return;
    setStatus("idle");
    if (handsFree) startListening();
  }
  async function send(text, viaVoice) {
    text = String(text || "").trim();
    if (!text || sending || paused) return;
    stopListening(); finals = ""; interim = ""; showInterim();
    if (!viaVoice) handsFree = false;
    C.history.push({ role: "user", text }); save();
    await askCoach();
  }
  async function askCoach() {
    const last = C.history[C.history.length - 1]; last.failed = false;
    const prior = C.history.slice(0, -1).filter(m => !m.failed).map(({ role, text }) => ({ role, text }));
    sending = true; setStatus("thinking"); renderMsgs(true);
    try {
      const r = await callWithRetry("/api/coach", { stage: stage.id, history: prior, userText: last.text, covered: C.covered, sid: SID });
      const before = new Set(C.covered);
      C.history.push({ role: "coach", text: r.reply }); C.covered = r.covered || C.covered; C.nextFocus = r.nextFocus; save();
      sending = false;
      if (!alive) return;
      renderMsgs(); renderChecklist(C.covered.filter(id => !before.has(id)));
      if (paused) coachControls();
      await speakCoach(r.reply);
    } catch (e) {
      sending = false; last.failed = true; save();
      if (!alive) return;
      setStatus("idle"); renderMsgs(); if (paused) coachControls();
      toast(e.status === 429 ? e.message : "Couldn't reach your coach. Tap Retry on your message.", "err");
    }
  }

  async function openVerdict() {
    stopListening(); tts.stop(); handsFree = false; setStatus("idle");
    const history = C.history.filter(m => !m.failed).map(({ role, text }) => ({ role, text }));
    const m = openModal(`
      <div class="row" style="gap:14px"><div class="avatar meera lg thinking" id="vAv">MK</div>
        <div><h2>Your pitch readiness check</h2><div class="row small muted" style="gap:8px;margin-top:2px">Meera Kapoor <span class="ai-label">AI practice investor</span></div></div>
        <span class="spacer"></span><button class="iconbtn" data-close aria-label="Close">${icon("x", 18)}</button></div>
      <div id="vBody"><div class="shimmer" style="width:100%;height:140px;margin-top:20px"></div></div>`, () => tts.stop());
    $("[data-close]", m.el).addEventListener("click", m.close);
    const body = $("#vBody", m.el), vAv = $("#vAv", m.el);
    const load = async () => {
      body.innerHTML = `<div class="shimmer" style="width:100%;height:140px;margin-top:20px"></div>`; vAv.className = "avatar meera lg thinking";
      try {
        const v = await callWithRetry("/api/verdict", { stage: stage.id, history, sid: SID });
        const pill = { ready: ["ok", "Ready for Showtime"], almost: ["warn", "Almost there"], needs_work: ["bad", "Needs work"] }[v.verdict];
        body.innerHTML = `
          <div style="margin-top:18px"><span class="pill big ${pill[0]}">${pill[1]}</span></div>
          <p style="font-size:18px;font-style:italic;margin-top:14px">"${esc(v.headline)}"</p>
          ${v.clear.length ? `<div class="msec"><h4>✅ What's clear</h4><ul class="mlist">${v.clear.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          ${v.missing.length ? `<div class="msec"><h4>❌ What's missing</h4><ul class="mlist">${v.missing.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          ${v.fixFirst ? `<div class="msec"><h4>🎯 Fix this first</h4><p style="margin-top:6px">${esc(v.fixFirst)}</p></div>` : ""}
          ${v.offline ? `<p class="flag" style="margin-top:14px">Offline mode: this is a keyword-based review, not an AI assessment.</p>` : ""}
          <div class="actions"><button class="btn" data-keep>Keep coaching</button><button class="btn primary" data-show>Go to Showtime ${icon("arrowRight", 16)}</button></div>`;
        $("[data-keep]", body).addEventListener("click", m.close);
        $("[data-show]", body).addEventListener("click", () => { m.close(); go("/briefing"); });
        vAv.className = "avatar meera lg speaking";
        await tts.speak(v.headline, "meera");
        vAv.className = "avatar meera lg";
      } catch (e) {
        vAv.className = "avatar meera lg";
        body.innerHTML = `<p class="flag" style="margin-top:18px">${esc(e.status && e.status < 500 ? e.message : "Meera couldn't give her take just now.")}</p>
          <div class="actions"><button class="btn" data-keep>Keep coaching</button><button class="btn primary" data-again>${icon("retry", 15)} Try again</button></div>`;
        $("[data-keep]", body).addEventListener("click", m.close);
        $("[data-again]", body).addEventListener("click", load);
      }
    };
    load();
  }

  // events
  micBtn.addEventListener("click", micTap);
  function micTap() {
    if (sending || paused) return;
    if (status === "speaking") { tts.stop(); handsFree = true; return startListening(); }
    if (mic.on) { const t = `${finals} ${interim}`.trim(); if (t) send(t, true); else { handsFree = false; stopListening(); } return; }
    handsFree = true; startListening();
  }
  $("#typeIn", root).value = C.draft || "";
  $("#typeIn", root).addEventListener("input", e => { C.draft = e.target.value; save(); });
  $("#typeForm", root).addEventListener("submit", (e) => {
    e.preventDefault(); if (paused) return;
    const inp = $("#typeIn", root); const t = inp.value; inp.value = ""; C.draft = ""; save(); send(t, false);
  });
  msgsEl.addEventListener("click", (e) => {
    const r = e.target.closest("[data-replay]");
    if (r) { stopListening(); handsFree = false; const txt = C.history[+r.dataset.replay]?.text; if (txt) speakCoach(txt); return; }
    if (e.target.closest("[data-resend]") && !sending) askCoach();
  });
  $("#verdictBtn", root).addEventListener("click", openVerdict);
  const coachControls = () => {
    $("#stopPractice", root).disabled = paused;
    $("#resumePractice", root).disabled = !paused;
    $("#typeIn", root).disabled = paused;
    $("button[type=submit]", root).disabled = paused;
    micBtn.disabled = paused || !SR;
    $("#practiceStatus", root).textContent = paused ? "Stopped. Your conversation and draft are saved in this tab." : "Practice in progress. Stop saves your place without submitting.";
    if (paused) {
      statusEl.textContent = "Stopped · progress saved";
      $("#verdictBtn", root).disabled = true;
    } else { setStatus("idle"); updateVerdictBtn(); }
  };
  $("#stopPractice", root).addEventListener("click", () => {
    paused = true; C.paused = true; handsFree = false;
    C.draft = [$("#typeIn", root).value, finals, interim].filter(Boolean).join(" ").slice(0, 2000);
    $("#typeIn", root).value = C.draft; finals = ""; interim = "";
    stopListening(); tts.stop(); save(); coachControls();
  });
  $("#resumePractice", root).addEventListener("click", () => {
    paused = false; C.paused = false; save(); coachControls(); $("#typeIn", root).focus();
  });
  $("#resetPractice", root).addEventListener("click", () => {
    if (!confirm("Reset this coaching session? Its conversation and unsent draft will be cleared. Your pitch reports will stay saved.")) return;
    S.coach = null; save(); router();
  });
  bindLang(root, () => { if (mic.on) { mic.stop(); startListening(); } });
  const onKey = (e) => {
    if (e.code !== "Space" || e.repeat || $("#overlay").children.length) return;
    if (e.target.closest("input, textarea, button, a, [role=radio], select, summary")) return;
    e.preventDefault(); micTap();
  };
  document.addEventListener("keydown", onKey); onLeave(() => document.removeEventListener("keydown", onKey));

  // first render + empty state
  renderMsgs(); renderChecklist(); setStatus("idle");
  coachControls();
  if (!C.history.length) {
    C.history.push({ role: "coach", text: COACH_OPENER }); save(); renderMsgs(); track("coach_start");
    setTimeout(() => speakCoach(COACH_OPENER), 250);
  }
}

// ======================= SCREEN 5: SHOWTIME BRIEFING =======================
function briefingView(root) {
  const stage = stageById(S.stage); if (!stage) return go("/stage");
  root.innerHTML = `
  <div class="head"><h2>Showtime: ${esc(stage.name)} pitch</h2>
    <p>Explain your idea from start to finish to Meera, your AI practice investor. You have up to five minutes, without interruptions. Afterwards, get a clear plan for improving your next pitch.</p></div>
  <div class="grid g2">
    <div class="card"><div class="sec-title"><h3>A guide for your explanation</h3></div>
      ${checklistHtml(stage, [], null)}
      <p class="small muted" style="margin-top:10px"><span class="must">★</span> Key points for the ${esc(stage.name)} stage. You don't need a perfect script.</p></div>
    <div class="card" style="display:flex;flex-direction:column;gap:18px">
      <div class="sec-title" style="margin:0"><h3>Before you start</h3></div>
      <ul class="brief-rules">
        <li>${icon("clock", 18)}<span>Take up to five minutes. The countdown stays out of sight until the final 45 seconds.</span></li>
        <li>${icon("messageCircle", 18)}<span>Speak or type in English, Hindi, or Hinglish. Focus on your idea, not perfect English.</span></li>
        <li>${icon("square", 18)}<span>Need a break? Stop saves your place. Finished? Choose End pitch to get feedback. At five minutes, your pitch submits automatically.</span></li>
      </ul>
      <div class="row" style="gap:14px;margin-top:auto"><div class="avatar meera lg">MK</div>
        <div><div class="meera-name">Meera Kapoor <span class="ai-label">AI practice investor</span></div><div class="small muted">A fictional practice partner—not a real funding decision.</div></div></div>
      ${S.demo ? `<span class="pill accent" style="align-self:flex-start">Demo: sample Hinglish Seed pitch will be pre-filled</span>` : ""}
      <button class="btn primary lg" id="ready">I'm ready, start</button>
    </div>
  </div>`;
  $("#ready", root).addEventListener("click", () => { S.show = newShow(stage.id, "countdown"); save(); go("/showtime"); });
}
const newShow = (stage, phase) => ({ stage, phase, pending: null });

// ======================= SCREEN 6: SHOWTIME ROOM =======================
function showtimeView(root) {
  S.lastPractice = "pitch";
  const stage = stageById(S.stage); if (!stage) return go("/stage");
  if (!S.show || S.show.stage !== stage.id) S.show = newShow(stage.id, "ready");
  const sh = S.show;
  if (sh.phase === "judging" && sh.pending) return judgingView(root, stage, sh.pending);
  if (sh.phase === "short") return tooShortView(root, stage);
  const startNow = sh.phase === "countdown";
  const restored = sh.phase === "paused" || sh.phase === "live";
  sh.phase = restored ? "paused" : "ready"; save();

  let alive = true, phase = restored ? "paused" : "ready", t0 = 0, timerInt = null, interim = "", muted = false;
  let elapsedMs = Math.min(PITCH_SECONDS * 1000, Math.max(0, Number(sh.elapsedMs) || 0)), checkpoint = 0;
  const segs = Array.isArray(sh.segs) ? sh.segs : [];
  onLeave(() => { if (phase === "live" || phase === "paused") persistPitch(); alive = false; clearInterval(timerInt); mic.stop(); closeOverlay(); });

  root.innerHTML = `
  <div class="practice-toolbar" aria-label="Practice controls">
    <p id="practiceStatus" role="status">${restored ? "Saved pitch restored. Resume when you’re ready." : "Stop pauses the timer without submitting your pitch."}</p>
    <button class="btn sm" id="stopPractice" disabled>Stop</button>
    <button class="btn sm primary" id="resumePractice" ${restored ? "" : "disabled"}>Resume</button>
    <button class="btn sm" id="resetPractice">Reset</button>
  </div>
  <div class="room show-room">
    <section class="stage-show">
      <div class="row"><span class="pill accent">🎤 Showtime · ${esc(stage.name)}</span><span class="spacer"></span>${langToggle()}</div>
      <div class="pitch-time" id="timer" role="timer" aria-label="Time remaining" aria-live="off" ${PITCH_SECONDS - elapsedMs / 1000 > FINAL_COUNTDOWN_SECONDS ? "hidden" : ""}>${fmt(Math.ceil(PITCH_SECONDS - elapsedMs / 1000))}</div>
      <p class="small muted" id="timeNotice" role="status"></p>
      <div class="meera-zone">
        <div class="avatar meera xl" id="meera">MK</div>
        <div class="meera-name">Meera Kapoor <span class="ai-label">AI investor</span></div>
        <div class="small muted" id="meeraState">Your AI practice partner</div>
        <div class="reactions" id="reactions" aria-hidden="true"></div>
      </div>
      <div class="caption" id="caption"></div>
      ${noVoiceBanner()}
      <div class="live-tx" id="lt"><span class="ph">Your words will appear here as you speak.</span></div>
      <div id="micErr"></div>
      <div class="show-controls">
        <button class="mic off" id="mic" aria-label="Mute microphone" disabled>${icon("mic", 32)}</button>
        <button class="btn lg" id="endBtn" disabled>${icon("square", 16)} End pitch</button>
      </div>
      <div class="hint"><kbd>Space</kbd> mutes or unmutes the mic</div>
    </section>
    <aside class="show-side">
      <div class="card">
        <button class="btn sm" id="ckToggle" aria-expanded="false">${icon("list", 14)} Show checklist</button>
        <div id="miniCk" hidden style="margin-top:12px">${checklistHtml(stage, [], null, { cls: "mini-check" })}</div>
      </div>
      <details class="card" id="typed" ${!SR || S.demo ? "open" : ""}>
        <summary>${icon("keyboard", 18)} Type instead ${icon("chevronDown", 18)}</summary>
        <p class="small muted" style="margin:10px 0">Prefer typing? You have the same five-minute practice window. Stop pauses your session.</p>
        ${S.demo ? `<span class="pill accent" style="margin-bottom:10px">Demo transcript loaded (sample)</span>` : ""}
        <textarea class="field" id="typedTx" placeholder="Type your pitch here…" maxlength="10000" ${restored ? "disabled" : ""}>${esc(sh.typedDraft || (S.demo ? DEMO_PITCH : ""))}</textarea>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="submitTyped" disabled>${icon("send", 15)} Submit</button>
          <span class="small muted" id="typedHint">Write your draft here. Submit when you're ready.</span></div>
      </details>
    </section>
  </div>`;

  const timerEl = $("#timer", root), meera = $("#meera", root), lt = $("#lt", root), micBtn = $("#mic", root), endBtn = $("#endBtn", root), caption = $("#caption", root);
  const mic = new Mic({
    onFinal: (seg) => {
      if (phase !== "live") return;
      segs.push({ ...seg, start: elapsedMs + Math.max(0, seg.start - t0), end: elapsedMs + Math.max(0, seg.end - t0) });
      interim = ""; renderTx(); react(seg.text); persistPitch();
    },
    onInterim: (t) => { interim = t; renderTx(); },
    onLevel: (l) => micBtn.style.setProperty("--level", l.toFixed(3)),
    onError: (err) => {
      micBtn.classList.remove("on");
      if (err === "denied") { $("#micErr", root).innerHTML = deniedCard(); $("[data-retry-mic]", root).addEventListener("click", () => { $("#micErr", root).innerHTML = ""; startMic(); }); $("#typed", root).open = true; }
      else if (err === "nomic" || err === "network" || err === "ended") { toast("The mic stopped. You can keep going by typing.", "err"); $("#typed", root).open = true; }
    },
  });
  const setMeera = (cls, label) => { meera.className = `avatar meera xl ${cls}`; $("#meeraState", root).textContent = label; };
  function renderTx() {
    const fin = segs.map(s => s.text).join(" ");
    lt.innerHTML = fin || interim ? `${esc(fin)} <span class="int">${esc(interim)}</span>` : `<span class="ph">${phase === "live" ? "Listening… start whenever you're ready." : "Your words will appear here as you speak."}</span>`;
    lt.scrollTop = lt.scrollHeight;
  }
  const REACT = [[/\d|lakh|crore|million|billion|percent|hazaar|thousand/i, "📈 noted"], [/customer|users?\b|creators?|clients?|grahak/i, "👥 who it's for"],
    [/problem|pain|dikkat|pareshan|struggl/i, "🎯 the problem"], [/revenue|\bmrr\b|\barr\b|paying|₹|rupee/i, "💵 revenue"],
    [/team|co-?founder/i, "🤝 team"], [/compet|alternative/i, "⚔️ landscape"], [/rais|funding|runway|invest/i, "💰 the ask"]];
  const lastChip = {}; let chipSlot = 0;
  function react(text) {
    const now = Date.now(); const hit = REACT.find(([re, lbl]) => re.test(text) && !(now - (lastChip[lbl] || 0) < 8000));
    if (!hit) return; lastChip[hit[1]] = now;
    const pos = [["8%", "18%"], ["70%", "14%"], ["4%", "58%"], ["74%", "56%"]][chipSlot++ % 4];
    const c = document.createElement("span"); c.className = "chip"; c.textContent = hit[1]; c.style.left = pos[0]; c.style.top = pos[1];
    $("#reactions", root)?.append(c); setTimeout(() => c.remove(), 2700);
  }
  async function startMic() {
    if (!SR || phase !== "live") return;
    muted = false; micBtn.classList.remove("off"); micBtn.classList.add("on"); micBtn.setAttribute("aria-label", "Mute microphone");
    try { await mic.start(S.micLang); } catch (e) { mic.o.onError(e.message); }
  }
  function toggleMute() {
    if (phase !== "live" || !SR) return;
    if (mic.on) { mic.stop(); muted = true; micBtn.classList.remove("on"); micBtn.setAttribute("aria-label", "Unmute microphone"); setMeera("", "Mic muted"); }
    else { startMic(); setMeera("listening", "Listening"); }
  }
  function tick() {
    const left = PITCH_SECONDS - (elapsedMs + Date.now() - t0) / 1000;
    timerEl.textContent = fmt(Math.ceil(left));
    const reveal = left <= FINAL_COUNTDOWN_SECONDS;
    timerEl.hidden = !reveal;
    timerEl.className = `pitch-time ${left <= 10 ? "ending" : ""}`;
    const notice = $("#timeNotice", root);
    if (reveal && !notice.textContent && left > 0) notice.textContent = `${Math.ceil(left)} seconds left. Bring your explanation to a close when you're ready.`;
    if (left <= 0) end("timeout");
    else if (Date.now() - checkpoint > 1000) { checkpoint = Date.now(); persistPitch(); }
  }
  function persistPitch() {
    sh.elapsedMs = Math.min(PITCH_SECONDS * 1000, elapsedMs + (phase === "live" ? Date.now() - t0 : 0));
    sh.segs = segs;
    sh.typedDraft = $("#typedTx", root)?.value || "";
    sh.phase = "paused"; // A reload always requires a deliberate Resume gesture.
    save();
  }
  function pausePitch() {
    if (phase !== "live") return;
    if (interim.trim()) segs.push({ text: interim.trim(), start: elapsedMs + Date.now() - t0, end: elapsedMs + Date.now() - t0 });
    elapsedMs += Date.now() - t0; phase = "paused"; interim = "";
    clearInterval(timerInt); mic.stop(); tts.stop(); persistPitch(); renderTx();
    $("#stopPractice", root).disabled = true; $("#resumePractice", root).disabled = false;
    endBtn.disabled = true; micBtn.disabled = true; $("#submitTyped", root).disabled = true; $("#typedTx", root).disabled = true;
    setMeera("", "Stopped · progress saved");
    $("#practiceStatus", root).textContent = "Stopped. Time, spoken words and typed draft are saved in this tab.";
  }
  function runClock() {
    phase = "live"; t0 = Date.now(); timerInt = setInterval(tick, 200);
    $("#stopPractice", root).disabled = false; $("#resumePractice", root).disabled = true;
    $("#typedTx", root).disabled = false; endBtn.disabled = false; micBtn.disabled = !SR; $("#submitTyped", root).disabled = false;
    $("#practiceStatus", root).textContent = "Practice in progress. Stop pauses the timer; End pitch submits for feedback.";
    setMeera("listening", SR ? "Listening" : "Ready for your typed pitch");
    renderTx(); tick();
    if (phase !== "live") return;
    if (SR) startMic(); else $("#typedTx", root).focus();
  }
  async function begin() {
    if (!alive) return;
    tts.prefetch(MEERA_INTRO, "meera"); // warm up her voice during the countdown
    // full-screen 3-2-1 countdown
    for (const n of [3, 2, 1]) {
      $("#overlay").innerHTML = `<div class="countdown" aria-live="assertive"><span>${n}</span></div>`;
      await sleep(1000); if (!alive) return;
    }
    closeOverlay();
    phase = "intro"; setMeera("speaking", "Speaking"); caption.textContent = `"${MEERA_INTRO}"`;
    await tts.speak(MEERA_INTRO, "meera"); if (!alive) return;
    caption.textContent = "";
    elapsedMs = 0; runClock();
    $("#typedHint", root).textContent = "Submit ends your pitch.";
    renderTx(); track("showtime_start");
  }
  function end(reason) {
    if (phase !== "live") return;
    phase = "ended"; clearInterval(timerInt); mic.stop();
    const tEnd = Date.now();
    const spoken = [segs.map(s => s.text).join(" "), interim].join(" ").trim();
    const typedRaw = $("#typedTx", root).value.trim();
    const typedUsed = reason === "typed" || (!spoken && typedRaw);
    const transcript = [spoken, typedUsed ? typedRaw : ""].filter(Boolean).join(" ").trim();
    const isDemo = S.demo && typedUsed && typedRaw === DEMO_PITCH.trim() && !spoken;
    let durationSec = Math.max(1, Math.round((elapsedMs + tEnd - t0) / 1000));
    if (isDemo) durationSec = Math.round(wordCount(DEMO_PITCH) / 140 * 60); // sample pitch: pace estimated at a natural 140 wpm
    let longPauses = 0, longest = 0;
    for (let i = 1; i < segs.length; i++) { const gap = (segs[i].start - segs[i - 1].end) / 1000; if (gap > 2.5) longPauses++; longest = Math.max(longest, gap); }
    const metrics = { durationSec, longPauses, longestPauseSec: Math.round(longest * 10) / 10, typed: !!typedUsed && !spoken && !isDemo };
    if (reason === "timeout") toast("Your five-minute practice is complete. Preparing your feedback.");
    if (wordCount(transcript) < 20) { S.show.phase = "short"; save(); return tooShortView(root, stage); }
    S.show.phase = "judging"; S.show.pending = { transcript, metrics, demo: isDemo }; save();
    judgingView(root, stage, S.show.pending);
  }

  endBtn.addEventListener("click", () => end("end"));
  $("#stopPractice", root).addEventListener("click", pausePitch);
  $("#resumePractice", root).addEventListener("click", runClock);
  $("#resetPractice", root).addEventListener("click", () => {
    if (!confirm("Reset this pitch? Its timer, spoken words and typed draft will be cleared. Saved reports will not be deleted.")) return;
    S.show = newShow(stage.id, "ready"); save(); router();
  });
  $("#typedTx", root).addEventListener("input", () => { if (phase === "live" || phase === "paused") persistPitch(); });
  const hidePitch = () => { if (document.hidden) pausePitch(); };
  document.addEventListener("visibilitychange", hidePitch);
  onLeave(() => document.removeEventListener("visibilitychange", hidePitch));
  micBtn.addEventListener("click", toggleMute);
  $("#submitTyped", root).addEventListener("click", () => { if (!$("#typedTx", root).value.trim()) return toast("Type your pitch first."); end("typed"); });
  $("#ckToggle", root).addEventListener("click", (e) => {
    const box = $("#miniCk", root); box.hidden = !box.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!box.hidden));
    e.currentTarget.innerHTML = `${icon("list", 14)} ${box.hidden ? "Show" : "Hide"} checklist`;
  });
  bindLang(root, () => { if (mic.on) { mic.stop(); startMic(); } });
  const onKey = (e) => {
    if (e.code !== "Space" || e.repeat) return;
    if (e.target.closest("input, textarea, button, a, select, summary")) return;
    e.preventDefault(); toggleMute();
  };
  document.addEventListener("keydown", onKey); onLeave(() => document.removeEventListener("keydown", onKey));

  renderTx();
  if (restored) { setMeera("", "Stopped · progress saved"); }
  else if (startNow) begin();
  else {
    // Arrived by refresh or link: need a tap first (browsers require a gesture for mic + speech).
    $("#overlay").innerHTML = `<div class="modal-bg"><div class="modal center" role="dialog" aria-modal="true">
      <div class="avatar meera lg" style="margin:0 auto 14px">MK</div><h2>Ready when you are</h2>
      <p class="muted" style="margin-top:8px">Take up to five minutes after Meera's introduction. There’s no visible countdown until the last 45 seconds. You can stop and resume whenever you need.</p>
      <div class="actions" style="justify-content:center"><a class="btn" href="#/briefing">Back to briefing</a><button class="btn primary" id="go">Start ${icon("arrowRight", 16)}</button></div></div></div>`;
    $("#go").addEventListener("click", () => { closeOverlay(); begin(); });
  }
}

function tooShortView(root, stage) {
  root.innerHTML = `<div class="card center" style="max-width:560px;margin:40px auto;padding:36px">
    <div class="avatar meera lg" style="margin:0 auto 16px">MK</div>
    <h2>Let's hear a little more of your idea.</h2><p class="muted" style="margin-top:10px">We need at least 20 words to give useful feedback. Start with who you're helping, their problem, and what you're building. You can speak or type.</p>
    <div class="actions" style="justify-content:center"><button class="btn" id="coach">Practice with Coach</button><button class="btn primary" id="retry">${icon("retry", 16)} Retry</button></div></div>`;
  $("#retry", root).addEventListener("click", () => { S.show = newShow(stage.id, "countdown"); save(); track("retry"); router(); });
  $("#coach", root).addEventListener("click", () => go("/coach"));
}

function judgingView(root, stage, pending) {
  let alive = true; onLeave(() => { alive = false; });
  const steps = ["Reviewing your explanation…", "Checking the points for your stage…", "Identifying what needs more detail…",
    ...(HEALTH_V.evaluator ? ["Cross-checking the evidence…"] : []), "Preparing your improvement plan…"];
  root.innerHTML = `<div class="center" style="padding:30px 0">
    <div class="avatar meera xl thinking" style="margin:0 auto 18px">MK</div>
    <h2>Turning your pitch into a practical next-step plan</h2><p class="muted" style="margin-top:6px">We're reviewing what you said and how to strengthen it. A detailed review can take up to a minute. Your pitch is saved in this tab.</p>
    <ul class="loading-steps" id="steps">${steps.map(s => `<li><span class="box"></span>${s}</li>`).join("")}</ul>
    <div id="jErr"></div></div>`;
  const lis = $$("#steps li", root);
  let k = 0; const adv = () => { if (!alive) return; lis.forEach((li, i) => li.className = i < k ? "done" : i === k ? "doing" : ""); };
  adv(); const timers = [900, 2000, 3300, 4600].slice(0, steps.length - 1).map((ms) => setTimeout(() => { k++; adv(); }, ms));
  onLeave(() => timers.forEach(clearTimeout));
  (async () => {
    try {
      const r = await callWithRetry("/api/judge", { stage: stage.id, transcript: pending.transcript, metrics: pending.metrics, demo: !!pending.demo, sid: SID });
      if (!alive) return;
      timers.forEach(clearTimeout); k = steps.length; adv();
      S.report = { ...r, stage: stage.id, transcript: pending.transcript, demo: !!pending.demo, spoken: false, at: Date.now() };
      S.show.phase = "done"; S.show.pending = null; save();
      $$(".box", root).forEach(b => b.innerHTML = icon("check", 12));
      await sleep(350); if (alive) go("/report");
    } catch (e) {
      if (!alive) return;
      if (e.status === 422) { S.show.phase = "short"; S.show.pending = null; save(); return tooShortView(root, stage); }
      timers.forEach(clearTimeout);
      $(".avatar", root).classList.remove("thinking");
      $("#jErr", root).innerHTML = `<p class="flag" style="max-width:460px;margin:18px auto 0">${esc(e.status === 429 ? e.message : "Meera couldn't finish your report. Your pitch is saved, so you can try again.")}</p>
        <div class="actions" style="justify-content:center"><button class="btn" id="redo">${icon("retry", 15)} Pitch again</button><button class="btn primary" id="again">Try the report again</button></div>`;
      $("#again", root).addEventListener("click", () => router());
      $("#redo", root).addEventListener("click", () => { S.show = newShow(stage.id, "countdown"); save(); router(); });
    }
  })();
}

// ======================= SCREEN 7: REPORT =======================
function highlight(text) {
  const phrases = [...new Set([...HEDGES, ...FILLERS])].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${phrases.map(escRe).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  let out = "", last = 0;
  for (const m of text.matchAll(re)) {
    const p = m[0].toLowerCase(), h = HEDGES.includes(p);
    out += esc(text.slice(last, m.index)) + `<mark class="${h ? "h" : "f"}" title="${h ? "Hedge" : "Filler"}">${esc(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
const top = (obj, n) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, n);

function reportView(root) {
  const R = S.report;
  if (!R) return go(S.stage ? "/briefing" : "/");
  const stage = stageById(R.stage);
  const checklist = addReportGuidance(stage, R.checklist || []);
  const M = R.metrics || {};
  const V = { take_meeting: ["ok", "A clear case for a follow-up", "var(--success)"], interested: ["warn", "Promising, with points to clarify", "var(--warning)"], not_yet: ["bad", "Let's strengthen the explanation", "var(--danger)"] }[R.verdict] || ["warn", "Some points need clarification", "var(--warning)"];
  const C = 2 * Math.PI * 56;
  const scoreCard = (k, label) => { const s = R.scores?.[k] || { score: 0, reason: "" }; return `<div class="card score-card"><h4>${label}</h4><div class="n">${s.score}<small> / 10</small></div><div class="bar"><i data-w="${s.score * 10}" style="background:${s.score >= 7 ? "var(--success)" : s.score >= 5 ? "var(--warning)" : "var(--danger)"}"></i></div><p>${esc(s.reason)}</p>${s.agent != null ? `<p class="small muted" style="margin-top:6px">Average of Meera and the Pitch Evaluator (${s.agent}/10)</p>` : ""}</div>`; };
  const stIcon = { covered: [icon("check", 17), "Covered"], weak: [icon("info", 17), "Needs detail"], missing: [icon("alert", 17), "Not explained"] };
  const paceCls = M.paceLabel === "Great" ? "ok" : "warn";
  root.innerHTML = `
  <div class="report">
    <div class="head"><h2>Your pitch feedback</h2><p>A practical review for your ${esc(stage?.name || "current")} stage. Use it to improve your explanation, not as a prediction of funding or business success.</p></div>
    ${R.offline ? `<div class="flag">Offline mode: this report uses simple keyword rules, not an AI assessment. It can miss context. The improvement plans below are based on your stage checklist.</div>` : ""}
    ${R.demo ? `<div class="flag">Sample demo transcript (fictional company). Pace and time used are estimated at 140 wpm.</div>` : ""}

    <section class="card verdict-hero sec" aria-label="Verdict">
      <div class="avatar meera lg" id="rAv">MK</div>
      <div class="vh-body">
        <div class="row"><span class="pill big ${V[0]}">${V[1]}</span><span class="small muted">Meera Kapoor · <span class="ai-label">AI investor</span> · ${esc(stage?.name || "")} stage</span></div>
        <p class="quote">"${esc(R.investorReaction)}"</p>
        <p class="oneline">Your idea, as understood from this pitch: <b>${esc(R.pitchInOneLine)}</b></p>
        ${R.missingMust ? `<p class="small" style="color:var(--warning);margin-top:8px">A key point for your stage wasn't explained clearly. The score includes a 10-point adjustment; use the plan below to work on it.</p>` : ""}
      </div>
      <div class="ring" aria-label="Overall score ${R.overall} out of 100">
        <svg width="132" height="132" viewBox="0 0 132 132"><circle cx="66" cy="66" r="56" fill="none" stroke="var(--border)" stroke-width="10"/>
          <circle class="fg" cx="66" cy="66" r="56" fill="none" stroke="${V[2]}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - R.overall / 100)}"/></svg>
        <div class="val"><div>${R.overall}<small>overall</small></div></div>
      </div>
    </section>

    <section class="grid g4 sec" aria-label="Scores">
      ${scoreCard("structure", "Story structure")}${scoreCard("clarity", "Clarity")}${scoreCard("substance", "Evidence & detail")}${scoreCard("delivery", "Communication")}
    </section>

    ${agentCard(R)}

    <section class="card sec"><div class="sec-title"><h3>${esc(stage?.name || "")} pitch checklist</h3><span class="spacer"></span><span class="small muted">${checklist.filter(c => c.status === "covered").length}/${checklist.length} clearly explained</span></div>
      <p class="small muted" style="margin-bottom:14px">Covered = explained clearly. Needs detail = mentioned, but not specific enough. Not explained = we couldn't find a clear answer. ★ marks a key point for this stage.</p>
      <table class="ct"><thead><tr><th>Status</th><th>Pitch point</th><th>What your pitch said</th></tr></thead><tbody>
      ${R.checklist.map(c => `<tr><td class="st" title="${stIcon[c.status][1]}">${stIcon[c.status][0]}<span class="sr">${stIcon[c.status][1]}</span></td>
        <td class="el">${esc(c.title)}${c.must ? ' <span class="must">★</span>' : ""}</td>
        <td><div class="ev ${c.evidence === "Not mentioned" ? "none" : ""}">${c.evidence === "Not mentioned" ? "Not mentioned" : `"${esc(c.evidence)}"`}</div>${c.note ? `<div class="note">${esc(c.note)}</div>` : ""}</td></tr>`).join("")}
      </tbody></table></section>
    ${improvementPlanHTML(checklist, esc)}

    <section class="sec"><div class="sec-title"><h3>Your speaking and wording patterns</h3></div><p class="small muted" style="margin-bottom:14px">These are prompts for reflection, not rules for sounding a certain way. Honest uncertainty is useful when you’re describing an early idea.</p>
      <div class="grid g4 tiles">
        <div class="card tile"><div class="k">Pace</div>${M.typed ? `<div class="v">—</div><div class="d">Typed pitch, so pace isn't measured.</div>` : `<div class="v">${M.wpm} wpm</div><span class="pill ${paceCls}">${esc(M.paceLabel)}</span><div class="d" style="margin-top:6px">110–165 wpm is ideal.</div>`}</div>
        <div class="card tile"><div class="k">Filler phrases detected</div><div class="v">${M.fillers?.total ?? 0}</div><div class="d">${top(M.fillers?.byWord, 3).map(([w, n]) => `"${esc(w)}" ×${n}`).join(" · ") || "No listed filler phrases detected."}</div></div>
        <div class="card tile"><div class="k">Uncertainty phrases detected</div><div class="v">${M.hedges?.total ?? 0}</div><div class="d">${top(M.hedges?.byPhrase, 3).map(([w, n]) => `"${esc(w)}"${n > 1 ? ` ×${n}` : ""}`).join(" · ") || "No listed uncertainty phrases detected."}</div></div>
        <div class="card tile"><div class="k">Longest pause · Practice time</div><div class="v">${M.typed ? "—" : `${M.longestPauseSec ?? 0}s`}</div><div class="d">${M.typed ? "" : `${M.longPauses ?? 0} pause${M.longPauses === 1 ? "" : "s"} over 2.5s · `}${fmt(M.durationSec)} / ${fmt(R.practiceLimitSec || 120)}</div></div>
      </div></section>

    <section class="grid g2 sec">
      <div class="card"><div class="sec-title"><h3>What to keep</h3></div>
        ${R.strengths.map(s => `<div class="item"><h4>${esc(s.title)}</h4>${s.quote ? `<div class="qblock">"${esc(s.quote)}"</div>` : ""}<p class="why">${esc(s.why)}</p></div>`).join("") || `<p class="muted">This review didn't identify a specific strength to highlight. Start with one improvement above and build from there.</p>`}</div>
      <div class="card"><div class="sec-title"><h3>Refine how you explain it</h3></div>
        ${R.fixes.map((f, i) => `<div class="item"><h4>${i + 1}. ${esc(f.title)}</h4>${f.youSaid ? `<div class="qblock said">You said: "${esc(f.youSaid)}"</div>` : ""}${f.try ? `<div class="qblock try">Try: "${esc(f.try)}"</div>` : ""}<p class="why">${esc(f.why)}</p></div>`).join("")}</div>
    </section>

    <section class="card sec"><div class="sec-title"><span class="avatar meera" style="width:32px;height:32px;font-size:11px">MK</span><h3>A question to prepare for</h3></div>
      <p style="font-size:18px;font-weight:600">"${esc(R.toughestQuestion?.question)}"</p>
      <p class="muted" style="margin-top:8px"><b style="color:var(--text)">How to answer:</b> ${esc(R.toughestQuestion?.howToAnswer)}</p></section>

    <section class="card sec"><div class="sec-title"><h3>A draft for your next practice</h3><span class="spacer"></span>
      <button class="btn sm" id="copyRw">${icon("copy", 14)} Copy</button><button class="btn sm" id="listenRw">${icon("volume", 14)} Listen</button></div>
      <p class="rewrite">${esc(R.rewrite)}</p>
      <p class="small muted" style="margin-top:10px">A suggested structure based on your pitch, not a script to memorise. Check every claim and fill the [placeholders] with your real facts.</p></section>

    <details class="card sec"><summary>Full transcript <span class="small muted" style="font-weight:400"><mark class="f">filler</mark> <mark class="h">hedge</mark></span>${icon("chevronDown", 18)}</summary>
      <div class="transcript">${highlight(R.transcript || "")}</div></details>
  </div>
  <div class="sticky-bar"><div class="in">
    <button class="btn primary" id="retryShow">↻ Retry Showtime</button>
    <button class="btn" id="toCoach">Practice with Coach</button>
    <button class="btn ghost" id="toStage">Change stage</button></div></div>`;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fg = $(".ring .fg", root); if (fg) fg.style.strokeDashoffset = fg.dataset.off;
    $$(".bar i", root).forEach(b => { b.style.width = `${b.dataset.w}%`; });
  }));
  $("#retryShow", root).addEventListener("click", () => { S.stage = R.stage; S.show = newShow(R.stage, "countdown"); save(); track("retry"); go("/showtime"); });
  $("#toCoach", root).addEventListener("click", () => { S.stage = R.stage; save(); go("/coach"); });
  $("#toStage", root).addEventListener("click", () => go("/stage"));
  const scoreSection = document.createElement("section");
  scoreSection.className = "card sec saved-score-panel";
  scoreSection.innerHTML = '<h3>Your leaderboard score</h3>';
  $(".sticky-bar", root).before(scoreSection);
  mountPublishPanel(scoreSection, R, { api, esc });
  $("#copyRw", root).addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(R.rewrite); toast("Copied"); }
    catch { const t = document.createElement("textarea"); t.value = R.rewrite; document.body.append(t); t.select(); try { document.execCommand("copy"); toast("Copied"); } catch { toast("Couldn't copy. Select the text instead.", "err"); } t.remove(); }
  });
  const listen = $("#listenRw", root); let playing = false;
  listen.addEventListener("click", async () => {
    if (playing) { tts.stop(); return; }
    playing = true; listen.innerHTML = `${icon("square", 14)} Stop`;
    await tts.speak(R.rewrite, "coach");
    playing = false; listen.innerHTML = `${icon("volume", 14)} Listen`;
  });
  if (!R.spoken && R.investorReaction) {
    R.spoken = true; save();
    const av = $("#rAv", root); av.classList.add("speaking");
    tts.speak(R.investorReaction, "meera").then(() => av.classList.remove("speaking"));
  }
}

// Section: second judge. The in-house "Pitch Evaluator" agent (evidence-first rubric engine) runs with Meera.
function agentCard(R) {
  const a = R.agent; if (!a) return "";
  const vp = { take_meeting: ["ok", "Take the meeting"], interested: ["warn", "Interested"], not_yet: ["bad", "Not yet"] }[a.verdict];
  const head = `<div class="sec-title"><h3>An additional evidence check</h3><span class="spacer"></span><span class="pill accent">AI cross-check</span></div>`;
  if (a.status !== "merged") {
    const why = "The additional AI review wasn't available for this pitch. Your report uses the primary review only.";
    return `<section class="card sec">${head}<p class="muted">${why}</p></section>`;
  }
  return `<section class="card sec">${head}
    <div class="grid g4 tiles">
      <div class="card tile"><div class="k">Its verdict</div><div class="v" style="font-size:18px">${vp ? `<span class="pill ${vp[0]}">${vp[1]}</span>` : "—"}</div></div>
      <div class="card tile"><div class="k">Its overall</div><div class="v">${a.overall ?? "—"}</div></div>
      <div class="card tile"><div class="k">Agreed with Meera</div><div class="v">${a.agreement != null ? `${a.agreement}%` : "—"}</div><div class="d">of checklist calls</div></div>
      <div class="card tile"><div class="k">Confidence</div><div class="v" style="text-transform:capitalize">${esc(a.confidence || "—")}</div></div>
    </div>
    ${a.redFlags?.length ? `<div class="msec"><h4>Claims or assumptions to check</h4><ul class="mlist">${a.redFlags.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <p class="small muted" style="margin-top:12px">Your scores and checklist above merge both judges: scores are averaged, and where they disagree the checklist leans cautious.</p></section>`;
}

// ======================= hidden: live usage stats (Proof of Life) =======================
async function statsView(root) {
  root.innerHTML = `<div class="head"><h2>Practice activity</h2><p>This page shows anonymous activity counts—not pitches, saved reports or account details.</p></div><div id="st" class="grid g4"></div>`;
  const load = async () => {
    try {
      const s = await api("/api/stats");
      const e = s.events || {};
      const tile = (k, v, d = "") => `<div class="card tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
      $("#st", root).innerHTML = tile("Unique visitors", s.uniqueVisitors, `since ${new Date(s.since).toLocaleString()}`) + tile("Showtime reports", e.report || 0, `${e.showtime_start || 0} pitches started`) +
        tile("Coach turns", e.coach_turn || 0, `${e.coach_start || 0} coach sessions`) + tile("Investor verdicts", e.verdict || 0, `${e.retry || 0} retries`) +
        tile("Evaluator runs", e.agent_review || 0, "second-judge cross-checks");
    } catch { $("#st", root).innerHTML = `<p class="muted">Couldn't load stats.</p>`; }
  };
  load(); const t = setInterval(load, 5000); onLeave(() => clearInterval(t));
}

const leaderboardView = root => renderLeaderboard(root, { api, esc, stages: STAGES, onLeave });
const ROUTES = { "/": home, "/stage": stageView, "/mode": modeView, "/coach": coachView, "/briefing": briefingView, "/showtime": showtimeView, "/report": reportView, "/stats": statsView, "/leaderboard": leaderboardView };

// ---------- boot ----------
const params = new URLSearchParams(location.search);
if (params.get("demo") === "1") {
  S.demo = true; S.stage = "seed"; save();
  if (!location.hash || location.hash === "#/" || location.hash === "#") history.replaceState(null, "", `${location.pathname}${location.search}#/briefing`);
}
try { if (!sessionStorage.getItem("sayso.visit")) { sessionStorage.setItem("sayso.visit", "1"); track("visit"); } } catch { track("visit"); }
const HEALTH = api("/api/health").catch(() => ({}));
HEALTH.then(h => { HEALTH_V = h || {}; TTS_MODE = h.tts || "browser"; if (!h.ai) { const p = $("#modePill"); p.hidden = false; p.textContent = "Offline mode"; p.title = "No AI key on the server: simple keyword rules are used."; } }).catch(() => {});
window.addEventListener("hashchange", router);
document.addEventListener("clarity:signout", () => {
  S.coach = null; S.show = null; S.report = null; save(); go("/");
});
router();
