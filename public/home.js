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
        <div class="cr-offline-note" hidden role="status">
          <span class="mode-pill">Offline mode</span>
          <span>Practice is available, but feedback uses keyword rules rather than AI.</span>
        </div>
        <section class="cr-hero" aria-labelledby="cr-main-title">
          <div class="cr-hero-copy">
            <p class="cr-overline">A place to find your voice</p>
            <h1 class="cr-title" id="cr-main-title">Speak confidently.<br><em>Be understood.</em></h1>
            <p class="cr-hero-text">
              Get comfortable saying what you mean, to anyone. Rehearse out loud
              in a space that helps you find your words and your confidence.
              <strong>Feedback is about your idea and delivery</strong> — never your grammar or accent.
            </p>
            <div class="cr-hero-action">
              <button class="cr-primary-start" id="startBtn" type="button" data-action="open" aria-controls="cr-setup" aria-expanded="false">
                Practise a startup pitch ${icon("arrowRight", 18)}
              </button>
              <span>Our first practice scenario · Coach or 2-minute pitch</span>
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
            <div><p class="cr-section-kicker">Start with one real moment</p><h2 class="cr-section-title" id="cr-practice-title">What would you like to say?</h2></div>
            <p>Choose a starting point. You can take it one step at a time.</p>
          </div>
          <div class="cr-pitch-card">
            <div class="cr-pitch-left">
              <span class="cr-pitch-icon" aria-hidden="true">${icon("lightbulb", 23)}</span>
              <div><span class="cr-live-tag">Available to try now</span><h3 class="cr-pitch-title">Share a startup idea</h3>
                <p class="cr-pitch-copy">Practice explaining your idea to an investor. Start with your stage, then choose a guided rehearsal or a two-minute pitch.</p>
              </div>
            </div>
            <button class="cr-start" type="button" data-action="open" aria-controls="cr-setup" aria-expanded="false">Start here ${icon("arrowRight", 17)}</button>
          </div>
          <div id="cr-setup" class="cr-flow" hidden></div>
        </section>
        <section class="cr-future" aria-labelledby="cr-future-title">
          <div><p class="cr-section-kicker">The same confidence, everywhere</p>
            <h2 class="cr-future-title" id="cr-future-title">More moments, in time.</h2>
            <p class="cr-future-copy">Startup pitching is just the first place to practice. These are future possibilities, not available yet.</p>
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
        <p class="cr-flow-desc">This helps shape the investor conversation. There’s no wrong place to begin.</p>
        <div class="cr-options" role="group" aria-label="Choose your startup stage">
          ${stages.map((item, index) => `<button class="cr-option" type="button" data-stage="${item.id}" aria-pressed="${item.id === stage}">
            <strong>${item.name}</strong><small>${["Still exploring", "Getting started", "Finding momentum", "Growing further"][index]}</small>
          </button>`).join("")}
        </div>
        <div class="cr-flow-actions"><span></span><button class="cr-step-continue" type="button" data-action="mode">Choose how to practice ${icon("arrowRight", 14)}</button></div>`;
    } else if (phase === "mode") {
      content = `<h3 class="cr-flow-title" tabindex="-1">How would you like to rehearse?</h3>
        <p class="cr-flow-desc">For your ${stageName()} idea, choose the kind of practice that feels right today.</p>
        <div class="cr-modes" role="group" aria-label="Choose a practice mode">
          <button class="cr-mode" type="button" data-mode="coach" aria-pressed="${mode === "coach"}">
            <span class="cr-mode-icon">${icon("messageCircle", 18)}</span><strong>Rehearse with a coach</strong>
            <small>A guided, back-and-forth practice to help you shape how you explain the idea.</small>
          </button>
          <button class="cr-mode" type="button" data-mode="pitch" aria-pressed="${mode === "pitch"}">
            <span class="cr-mode-icon">${icon("presentation", 18)}</span><strong>2-minute investor pitch</strong>
            <small>Practice delivering your idea in a focused, two-minute pitch.</small>
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
          <p>${mode === "coach" ? "A guided rehearsal" : "A two-minute investor pitch"} for your ${stageName()} idea, in ${language}. Take a breath. This is a place to try things out.</p>
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
    } else if (button.dataset.action === "launch") {
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
