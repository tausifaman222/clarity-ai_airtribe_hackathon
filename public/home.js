// The approved Clarity AI mockup, adapted to the existing plain-JavaScript app.
import { SCENARIOS, scenarioById } from "./scenarios.js";
// Setup uses local state; provider calls begin only in the existing practice rooms.
export function renderHome(root, { icon, stages, state, save, navigate, health, onLeave, langs = [], toast = () => {} }) {
  const languages = ["English", "हिंदी", "Hinglish"];
  let language = languages.includes(state.practiceLanguage)
    ? state.practiceLanguage : state.micLang === "hi-IN" ? "हिंदी" : "English";
  let stage = stages.some(item => item.id === state.stage) ? state.stage : stages[0].id;
  let phase = "closed";
  let focusFrame;

  root.innerHTML = `
    <div class="clarity-refresh">
      <div class="cr-shell">
        <header class="cr-header">
          <a class="cr-brand" href="#/" aria-label="Clarity AI home">
            <img class="cr-mark-img" src="/logo-mark.svg" alt="" width="36" height="36">
            <span>Clarity AI</span>
          </a>
          <div class="cr-header-note">${icon("messageCircle", 17)}<span>A little practice. A lot more you.</span></div>
        </header>
        <nav class="cr-product-nav" aria-label="Account and community">
          <a href="#/leaderboard">Leaderboard</a><div data-auth-controls></div>
        </nav>
        <section class="member-welcome"><h1>Your practice space</h1><p>Make your idea easier to understand, one practice at a time.</p></section>
        <div id="savedPractice"></div>
        <div class="cr-offline-note" hidden role="status">
          <span class="mode-pill">Offline mode</span>
          <span>AI feedback isn't available right now. You can still practise with a clearly labelled checklist-based review.</span>
        </div>
        <section class="cr-hero" aria-labelledby="cr-main-title">
          <div class="cr-hero-copy">
            <p class="cr-overline">A place to find your voice</p>
            <h1 class="cr-title" id="cr-main-title">Speak confidently.<br><em>Be understood.</em></h1>
            <p class="cr-hero-text">
              Get comfortable explaining your ideas to anyone. Start with what you're building,
              who it's for, and why it matters—even if you're still figuring parts out.
              <strong>Feedback focuses on your idea and how clearly you explain it</strong> — not your grammar or accent.
            </p>
            <div class="cr-hero-action">
              <button class="cr-primary-start" id="startBtn" type="button" data-action="open" aria-controls="cr-setup" aria-expanded="false">
                Practise a startup pitch ${icon("arrowRight", 18)}
              </button>
              <span>For early-stage founders and builders · Speak or type</span>
            </div>
            <div class="cr-language-row" role="group" aria-label="Choose a practice language">
              <span class="cr-language-label">Speak in the way that feels like you</span>
              ${languages.map(choice => `<button class="cr-lang" type="button" data-language="${choice}" aria-pressed="${choice === language}">${choice}</button>`).join("")}
            </div>
          </div>
          <div class="cr-visual" aria-label="A visual reminder to let your ideas be heard">
            <div class="cr-orbit" aria-hidden="true"><span class="cr-orbit-dot"></span></div>
            ${icon("sparkles", 25, "cr-small-star")}
            <div class="cr-quote-card">
              <div class="cr-quote-top"><span class="cr-quote-label">The idea, in your words</span>${icon("sparkles", 17, "cr-quote-spark")}</div>
              <p class="cr-quote">“I know what I want to say. I’m just finding <span>my way into it.</span>”</p>
              <div class="cr-quote-footer">
                <span class="cr-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
                <span>Practice at your own pace</span>
              </div>
            </div>
            <div class="cr-note-float">${icon("check", 15)}<span>Your point of view comes first</span></div>
          </div>
        </section>
        <section class="cr-practice" aria-labelledby="cr-practice-title">
          <div class="cr-practice-intro">
            <div><p class="cr-section-kicker">Our first practice scenario</p><h2 class="cr-section-title" id="cr-practice-title">Make your startup idea clearer.</h2></div>
            <p>You don't need a finished product or a polished pitch. Start where you are.</p>
          </div>
          <div class="cr-pitch-card">
            <div class="cr-pitch-left">
              <span class="cr-pitch-icon" aria-hidden="true">${icon("lightbulb", 23)}</span>
              <div><span class="cr-live-tag">Available now</span><h3 class="cr-pitch-title">Startup pitch practice</h3>
                <p class="cr-pitch-copy">See the full checklist, warm up with a coach, then deliver your uninterrupted five-minute pitch. Get feedback suited to your stage.</p>
              </div>
            </div>
            <button class="cr-start" type="button" data-action="open" aria-controls="cr-setup" aria-expanded="false">Start here ${icon("arrowRight", 17)}</button>
          </div>
          <div id="cr-setup" class="cr-flow" hidden></div>
        </section>
        <section class="cr-anything" aria-labelledby="cr-any-title">
          <div class="cr-practice-intro">
            <div><p class="cr-section-kicker">Practise anything</p><h2 class="cr-section-title" id="cr-any-title">What are you preparing for?</h2></div>
            <p>Describe it in your own words, in any language. The AI works out your situation and builds the practice: what to cover, a practice partner, and coaching that fits.</p>
          </div>
          <form class="cr-any-form" id="anyForm">
            <label class="sr" for="anyText">Describe what you're preparing for</label>
            <textarea id="anyText" class="field" rows="3" maxlength="1200" placeholder="e.g. Product manager interview at a fintech next Tuesday. Or: asking my manager for a 20% raise. Or: best man's speech at my brother's wedding."></textarea>
            <div class="cr-any-row">
              <label class="lang-select">🌐 <select id="anyLang" aria-label="Practice language">${langs.map(([code, name]) => `<option value="${code}" ${code === (state.micLang || "en-IN") ? "selected" : ""}>${name}</option>`).join("")}</select></label>
              <button class="cr-primary-start" type="submit" id="anyGo">Build my practice ${icon("arrowRight", 18)}</button>
            </div>
          </form>
          <p class="cr-section-kicker" style="margin-top:22px">Or start from a template</p>
          <div class="cr-templates">
            ${SCENARIOS.map(s => `<button type="button" class="cr-template" data-template="${s.id}"><span class="cr-template-emoji" aria-hidden="true">${s.emoji}</span><b>${s.name}</b><small>${s.blurb}</small></button>`).join("")}
            <button type="button" class="cr-template" data-action="open"><span class="cr-template-emoji" aria-hidden="true">🚀</span><b>Startup pitch</b><small>Stage-specific investor practice.</small></button>
          </div>
        </section>
        <footer class="cr-footer">
          <span class="cr-footer-brand"><img src="/logo-mark.svg" alt="" width="18" height="18" style="vertical-align:-4px;border-radius:5px"> Clarity AI · Speak confidently. Be understood.</span>
          <span class="cr-footer-principle"><strong>Your ideas first.</strong> Practise in 16 languages, including English, हिंदी and Hinglish.</span>
          <span class="made-with">Built at the <span class="airtribe-mark"><img src="/airtribe-logo.png" alt="" height="18" onerror="this.remove()">Airtribe</span> AI Builders Day hackathon · Made with <span aria-label="love">❤️</span> by <a href="https://www.linkedin.com/in/ashishkumar620" target="_blank" rel="noopener">Ashish Kumar</a> &amp; <a href="https://www.linkedin.com/in/tausif222" target="_blank" rel="noopener">Tausif</a></span>
          <span class="cr-footer-links"><a href="/contact">💬 Contact us on WhatsApp</a> · <a href="#/progress">Progress</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span>
        </footer>
      </div>
    </div>`;

  const flow = root.querySelector("#cr-setup");
  const savedPitch = state.show?.phase === "paused";
  const savedCoach = state.coach?.paused && state.lastPractice !== "pitch";
  const resumeKind = state.lastPractice === "coach" && savedCoach ? "coach" : savedPitch ? "pitch" : savedCoach ? "coach" : null;
  if (resumeKind) {
    root.querySelector("#savedPractice").innerHTML = `<aside class="cr-resume"><div><strong>Your practice is saved.</strong><p>Continue your ${resumeKind === "pitch" ? "pitch, with its timer and draft" : "coaching conversation"}. Saved in this tab.</p></div><button class="cr-step-continue" type="button" data-action="restore">Resume practice</button></aside>`;
  }
  const stageName = () => stages.find(item => item.id === stage).name;
  const remember = () => {
    state.stage = stage; state.scenario = null;
    state.practiceMode = "warmup-interview";
    state.practiceLanguage = language;
    state.micLang = language === "हिंदी" ? "hi-IN" : "en-IN";
    save();
  };
  const moveFocus = () => {
    cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      if (!root.isConnected) return;
      const heading = flow.querySelector("h3");
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  };
  function renderSetup(focus = true) {
    flow.hidden = phase === "closed";
    root.querySelectorAll('[data-action="open"]').forEach(button => button.setAttribute("aria-expanded", String(!flow.hidden)));
    if (flow.hidden) {
      flow.innerHTML = "";
      root.querySelector("#startBtn").focus();
      return;
    }
    const progress = phase === "stage" ? "Step 1 of 2 · Your starting point" : "Step 2 of 2 · Your interview plan";
    let content;
    if (phase === "stage") {
      content = `<h3 class="cr-flow-title" tabindex="-1">Where are you with your idea?</h3>
        <p class="cr-flow-desc">Choose the closest match. We'll focus on what matters at this stage, not what a more mature company should have.</p>
        <div class="cr-options" role="group" aria-label="Choose your startup stage">
          ${stages.map((item, index) => `<button class="cr-option" type="button" data-stage="${item.id}" aria-pressed="${item.id === stage}">
            <strong>${item.name}</strong><small>${["Still exploring", "Getting started", "Finding momentum", "Growing further"][index]}</small>
          </button>`).join("")}
        </div>
        <div class="cr-flow-actions"><span></span><button class="cr-step-continue" type="button" data-action="mode">Review the interview plan ${icon("arrowRight", 14)}</button></div>`;
    } else if (phase === "mode") {
      content = `<h3 class="cr-flow-title" tabindex="-1">One practice path, from warm-up to interview</h3>
        <p class="cr-flow-desc">Here’s everything the ${stageName()} interview will look for. Take a couple of turns with your coach if helpful, then start the uninterrupted interview when you’re ready.</p>
        <ol class="cr-flow-steps">
          <li><b>Warm up</b><span>Talk through your idea with a coach. The complete checklist is visible below—nothing is hidden.</span></li>
          <li><b>Investor interview</b><span>Give your explanation without interruptions, for up to five minutes. The countdown appears only in the final 45 seconds.</span></li>
          <li><b>Personal feedback</b><span>See what was clear, exactly what needs more detail, and how to improve each missing point.</span></li>
        </ol>
        <section class="cr-stage-checklist" aria-labelledby="cr-checklist-title">
          <h4 id="cr-checklist-title">Full ${stageName()} checklist</h4>
          <p>Use these points as a guide, not a script.</p>
          <ol>${stages.find(item => item.id === stage).items.map(item => `<li>${item.must ? `<span class="cr-key-point">Key</span>` : ""}<div><b>${item.title}</b><p>${item.good}</p></div></li>`).join("")}</ol>
        </section>
        <div class="cr-flow-actions">
          <button class="cr-flow-back" type="button" data-action="stage">${icon("arrowLeft", 14)} Change stage</button>
          <button class="cr-step-continue" type="button" data-action="launch">Start my warm-up ${icon("arrowRight", 14)}</button>
        </div>`;
    }
    flow.innerHTML = `<div class="cr-flow-head">
       <div class="cr-flow-progress"><span>${phase === "stage" ? "1" : "2"}</span>${progress}</div>
      <button class="cr-flow-close" type="button" data-action="close" aria-label="Close practice setup">${icon("x", 16)} Close</button>
    </div><div class="cr-flow-body">${content}</div>`;
    if (focus) moveFocus();
  }

  const anyForm = root.querySelector("#anyForm");
  root.querySelector("#anyLang").addEventListener("change", e => { state.micLang = e.target.value; save(); });
  anyForm.addEventListener("submit", async event => {
    event.preventDefault();
    const description = root.querySelector("#anyText").value.trim();
    if (description.split(/\s+/).length < 2) { toast("Tell us a little more: who you'll speak to and why."); return; }
    const go = root.querySelector("#anyGo"); go.disabled = true; go.textContent = "Understanding your situation…";
    try {
      const res = await fetch("/api/scenario", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, lang: state.micLang, sid: localStorage.getItem("sayso.sid") || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't build that practice.");
      if (data.kind === "pitch") { state.stage = data.stage || "idea"; state.scenario = null; save(); navigate("/mode"); return; }
      state.scenario = { ...data.scenario, description }; state.stage = "custom"; state.coach = null; state.show = null; save();
      if (data.fallback || data.offline) toast("We matched your description to our closest template. You can edit it.");
      navigate("/scenario");
    } catch (e) { toast(e.message, "err"); go.disabled = false; go.innerHTML = `Build my practice ${icon("arrowRight", 18)}`; }
  });

  const click = event => {
    const button = event.target.closest("button");
    if (!button || !root.contains(button)) return;
    if (button.dataset.template) {
      state.scenario = JSON.parse(JSON.stringify(scenarioById(button.dataset.template)));
      state.stage = "custom"; state.coach = null; state.show = null; save(); navigate("/scenario"); return;
    }
    if (button.dataset.language) {
      language = button.dataset.language;
      remember();
      root.querySelectorAll("[data-language]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.language === language)));
    } else if (button.dataset.stage) {
      stage = button.dataset.stage;
      remember();
      flow.querySelectorAll("[data-stage]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.stage === stage)));
    } else if (button.dataset.action === "restore") {
      state.stage = resumeKind === "pitch" ? state.show.stage : state.coach.stage;
      save(); navigate(resumeKind === "pitch" ? "/showtime" : "/coach");
    } else if (button.dataset.action === "launch") {
      remember();
      state.demo = false;
      save();
      navigate("/coach");
    } else if (button.dataset.action) {
      const action = button.dataset.action;
      phase = action === "open" ? "stage" : action === "close" ? "closed" : action;
      remember();
      renderSetup();
    }
  };
  root.addEventListener("click", click);
  health.then(status => {
    if (root.isConnected && status.ok && !status.ai) root.querySelector(".cr-offline-note").hidden = false;
  });
  onLeave(() => {
    cancelAnimationFrame(focusFrame);
    root.removeEventListener("click", click);
  });
}
