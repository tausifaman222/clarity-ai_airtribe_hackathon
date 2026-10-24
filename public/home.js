// The approved Clarity AI mockup, adapted to the existing plain-JavaScript app.
// Setup uses local state; provider calls begin only in the existing practice rooms.
export function renderHome(root, { icon, stages, state, save, navigate, health, onLeave }) {
  const languages = ["English", "हिंदी", "Hinglish"];
  let language = languages.includes(state.practiceLanguage)
    ? state.practiceLanguage : state.micLang === "hi-IN" ? "हिंदी" : "English";
  let stage = stages.some(item => item.id === state.stage) ? state.stage : stages[0].id;
  let mode = state.practiceMode === "pitch" ? "pitch" : "coach";
  let phase = "closed";
  let focusFrame;

  root.innerHTML = `
    <div class="clarity-refresh">
      <div class="cr-shell">
        <header class="cr-header">
          <a class="cr-brand" href="#/" aria-label="Clarity AI home">
            <span class="cr-mark" aria-hidden="true">${icon("audioLines", 20)}</span>
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
                <p class="cr-pitch-copy">Work through your story with a coach, or practise a full pitch with up to five minutes to explain it. Get feedback suited to your stage.</p>
              </div>
            </div>
            <button class="cr-start" type="button" data-action="open" aria-controls="cr-setup" aria-expanded="false">Start here ${icon("arrowRight", 17)}</button>
          </div>
          <div id="cr-setup" class="cr-flow" hidden></div>
        </section>
        <section class="cr-future" aria-labelledby="cr-future-title">
          <div><p class="cr-section-kicker">The same confidence, everywhere</p>
            <h2 class="cr-future-title" id="cr-future-title">More ways to practise, coming later.</h2>
            <p class="cr-future-copy">The goal is confidence in any conversation. Startup pitching is our first use case; these other scenarios are not available yet.</p>
          </div>
          <div class="cr-future-list" aria-label="Future practice situations">
            <span class="cr-future-item">${icon("messageCircle", 15)} Salary conversation <small>Coming later</small></span>
            <span class="cr-future-item">${icon("presentation", 15)} A presentation <small>Coming later</small></span>
            <span class="cr-future-item">${icon("mic", 15)} Any big conversation <small>Coming later</small></span>
          </div>
        </section>
        <footer class="cr-footer">
          <span class="cr-footer-brand">${icon("audioLines", 15)} Clarity AI</span>
          <span class="cr-footer-principle"><strong>Your ideas first.</strong> Speak in English, हिंदी, or Hinglish.</span>
        </footer>
      </div>
    </div>`;

  const flow = root.querySelector("#cr-setup");
  const savedPitch = state.show?.phase === "paused";
  const savedCoach = state.coach?.paused;
  const resumeKind = state.lastPractice === "coach" && savedCoach ? "coach" : savedPitch ? "pitch" : savedCoach ? "coach" : null;
  if (resumeKind) {
    root.querySelector("#savedPractice").innerHTML = `<aside class="cr-resume"><div><strong>Your practice is saved.</strong><p>Continue your ${resumeKind === "pitch" ? "pitch, with its timer and draft" : "coaching conversation"}. Saved in this tab.</p></div><button class="cr-step-continue" type="button" data-action="restore">Resume practice</button></aside>`;
  }
  const stageName = () => stages.find(item => item.id === stage).name;
  const remember = () => {
    state.stage = stage;
    state.practiceMode = mode;
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
    const progress = phase === "stage" ? "Step 1 of 2 · Your starting point" : phase === "mode" ? "Step 2 of 2 · Your practice style" : "Ready to begin";
    let content;
    if (phase === "stage") {
      content = `<h3 class="cr-flow-title" tabindex="-1">Where are you with your idea?</h3>
        <p class="cr-flow-desc">Choose the closest match. We'll focus on what matters at this stage, not what a more mature company should have.</p>
        <div class="cr-options" role="group" aria-label="Choose your startup stage">
          ${stages.map((item, index) => `<button class="cr-option" type="button" data-stage="${item.id}" aria-pressed="${item.id === stage}">
            <strong>${item.name}</strong><small>${["Still exploring", "Getting started", "Finding momentum", "Growing further"][index]}</small>
          </button>`).join("")}
        </div>
        <div class="cr-flow-actions"><span></span><button class="cr-step-continue" type="button" data-action="mode">Choose how to practice ${icon("arrowRight", 14)}</button></div>`;
    } else if (phase === "mode") {
      content = `<h3 class="cr-flow-title" tabindex="-1">How would you like to rehearse?</h3>
        <p class="cr-flow-desc">For your ${stageName()} idea, choose guided help or an uninterrupted run-through. You can try the other style later.</p>
        <div class="cr-modes" role="group" aria-label="Choose a practice mode">
          <button class="cr-mode" type="button" data-mode="coach" aria-pressed="${mode === "coach"}">
            <span class="cr-mode-icon">${icon("messageCircle", 18)}</span><strong>Rehearse with a coach</strong>
            <small>Shape your story one point at a time. Speak or type, ask questions, and get feedback after each turn. No time limit.</small>
          </button>
          <button class="cr-mode" type="button" data-mode="pitch" aria-pressed="${mode === "pitch"}">
            <span class="cr-mode-icon">${icon("presentation", 18)}</span><strong>Full pitch practice</strong>
            <small>Explain your idea without interruptions, with up to five minutes. The countdown appears only in the last 45 seconds.</small>
          </button>
        </div>
        <div class="cr-flow-actions">
          <button class="cr-flow-back" type="button" data-action="stage">${icon("arrowLeft", 14)} Back to stage</button>
          <button class="cr-step-continue" type="button" data-action="ready">Confirm practice setup ${icon("arrowRight", 14)}</button>
        </div>`;
    } else {
      content = `<div class="cr-ready" role="status">
        <span class="cr-ready-icon">${icon("check", 23)}</span>
        <div><h3 tabindex="-1">You’re ready to practice.</h3>
          <p>${mode === "coach" ? "A guided rehearsal" : "A full pitch practice"} for your ${stageName()} idea, in ${language}. Start with what you know. This is practice, not a test.</p>
        </div>
        <p class="cr-ready-note">You can speak or type. Microphone permission is only requested when you begin speaking.</p>
      </div>
      <div class="cr-ready-actions">
        <button type="button" data-action="launch">${mode === "coach" ? "Start coaching" : "Enter Showtime"} ${icon("arrowRight", 15)}</button>
        <button type="button" data-action="stage">Change choices</button>
      </div>`;
    }
    flow.innerHTML = `<div class="cr-flow-head">
      <div class="cr-flow-progress"><span>${phase === "stage" ? "1" : phase === "mode" ? "2" : icon("check", 13)}</span>${progress}</div>
      <button class="cr-flow-close" type="button" data-action="close" aria-label="Close practice setup">${icon("x", 16)} Close</button>
    </div><div class="cr-flow-body">${content}</div>`;
    if (focus) moveFocus();
  }

  const click = event => {
    const button = event.target.closest("button");
    if (!button || !root.contains(button)) return;
    if (button.dataset.language) {
      language = button.dataset.language;
      remember();
      root.querySelectorAll("[data-language]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.language === language)));
      if (phase === "ready") renderSetup(false);
    } else if (button.dataset.stage) {
      stage = button.dataset.stage;
      remember();
      flow.querySelectorAll("[data-stage]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.stage === stage)));
    } else if (button.dataset.mode) {
      mode = button.dataset.mode;
      remember();
      flow.querySelectorAll("[data-mode]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.mode === mode)));
    } else if (button.dataset.action === "restore") {
      state.stage = resumeKind === "pitch" ? state.show.stage : state.coach.stage;
      save(); navigate(resumeKind === "pitch" ? "/showtime" : "/coach");
    } else if (button.dataset.action === "launch") {
      if (mode === "pitch" && savedPitch) {
        if (!confirm("Start a new pitch and clear the saved pitch draft and timer? Choose Resume practice instead to keep going.")) return;
        state.show = null;
      }
      remember();
      state.demo = false;
      save();
      navigate(mode === "coach" ? "/coach" : "/briefing");
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
