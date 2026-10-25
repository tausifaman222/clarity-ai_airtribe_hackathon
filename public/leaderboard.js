export function renderLeaderboard(root, { api, esc, stages, onLeave }) {
  let alive = true, revision = 0, accountRevision = 0, input = "spoken";
  onLeave(() => { alive = false; revision++; });
  root.innerHTML = `<div class="head"><h1 class="community-title">Practice leaderboard</h1>
    <p class="muted">Compare practice scores, not the value of your startup. Each person's best published, AI-reviewed pitch appears once per stage and input style. Sharing is optional.</p></div>
    <div class="leader-filters card">
      <label>Startup stage <select class="field" id="leaderStage">${stages.map(stage => `<option value="${stage.id}">${esc(stage.name)}</option>`).join("")}</select></label>
      <div class="seg" role="group" aria-label="Practice input style">
        <button type="button" data-input="spoken" aria-pressed="true">Spoken pitches</button>
        <button type="button" data-input="typed" aria-pressed="false">Typed pitches</button>
      </div>
    </div>
    <p class="small muted" style="margin:16px 0">Scores are out of 100 and reflect an AI review of one explanation—not business potential. Ties share a rank. Offline feedback and sample demo pitches are not ranked.</p>
    <div class="card" id="rankings" aria-live="polite"></div>
    <section class="card sec" id="myScores"><h2>Your saved scores</h2><p class="muted">Checking your account…</p></section>`;
  const load = async () => {
    const version = ++revision, container = root.querySelector("#rankings");
    container.innerHTML = "<p>Loading published scores…</p>";
    try {
      const result = await api(`/api/leaderboard?stage=${encodeURIComponent(root.querySelector("#leaderStage").value)}&input=${input}`);
      if (!alive || version !== revision) return;
      container.innerHTML = result.entries.length
        ? `<div class="leader-table"><table><caption class="sr">Published ${input} pitch rankings</caption><thead><tr><th scope="col">Rank</th><th scope="col">Public name</th><th scope="col">Best score</th></tr></thead><tbody>
          ${result.entries.map(entry => `<tr><td>${entry.rank}</td><th scope="row">${esc(entry.name)}</th><td><strong>${entry.score}</strong><span class="small muted"> / 100</span></td></tr>`).join("")}
          </tbody></table></div>`
        : `<div class="leader-empty"><h2>No published scores yet.</h2><p>Be the first to share a verified score in this group. Your transcript and feedback stay private.</p><a class="btn primary" href="#/">Start a practice</a></div>`;
    } catch (error) {
      if (!alive || version !== revision) return;
      container.innerHTML = `<p role="alert">${esc(error.message)}</p><button class="btn sm" id="retryRankings" style="margin-top:12px">Try again</button>`;
      root.querySelector("#retryRankings").onclick = load;
    }
  };
  root.querySelector("#leaderStage").onchange = load;
  root.querySelectorAll("[data-input]").forEach(button => button.onclick = () => {
    input = button.dataset.input;
    root.querySelectorAll("[data-input]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.input === input)));
    load();
  });
  const myScores = async () => {
    const version = ++accountRevision;
    const container = root.querySelector("#myScores");
    try {
      const result = await api("/api/me/attempts");
      if (!alive || version !== accountRevision) return;
      container.innerHTML = `<h2>Your saved scores</h2><p class="small muted">Scores stay private until you publish one with a public name. Your username and password are never shown on the leaderboard.</p>
        ${result.attempts.length ? '<div class="my-score-list"></div><button class="btn sm" id="withdrawScores">Remove all my scores from the leaderboard</button><p id="withdrawStatus" role="status"></p>' : '<p style="margin-top:16px">No verified scores yet. Complete an AI-reviewed pitch while signed in to save your first one.</p>'}`;
      const list = container.querySelector(".my-score-list");
      result.attempts.forEach(attempt => {
        const section = document.createElement("section");
        section.className = "my-score";
        section.innerHTML = `<h3>${esc(stages.find(stage => stage.id === attempt.stage)?.name || attempt.stage)} · ${attempt.input_mode} · ${attempt.score}/100</h3><p class="small muted">${new Date(attempt.created_at).toLocaleDateString()} · ${attempt.published ? "Published" : "Private"}</p>`;
        list.append(section);
        mountPublishPanel(section, { attemptId: attempt.id, leaderboardStatus: "private", published: attempt.published }, { api, esc, onPublished: load });
      });
      const remove = container.querySelector("#withdrawScores");
      if (remove) remove.onclick = async () => {
        if (!confirm("Remove all your published scores from the public leaderboard? Your private scores will remain saved.")) return;
        remove.disabled = true;
        try {
          const response = await fetch("/api/leaderboard/entries", { method: "DELETE" });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Couldn't remove scores.");
          if (!alive) return;
          await Promise.all([load(), myScores()]);
        } catch (error) { if (alive) { remove.disabled = false; container.querySelector("#withdrawStatus").textContent = error.message; } }
      };
    } catch (error) {
      if (!alive || version !== accountRevision) return;
      container.innerHTML = error.status === 401
        ? '<h2>Your saved scores</h2><p>Sign in or create a username and password to save scores privately. Publishing is optional;</p><div class="actions" style="margin-top:16px"><a class="btn" href="/sign-in">Sign in</a><a class="btn primary" href="/sign-up">Create account</a></div>'
        : `<h2>Your saved scores</h2><p role="alert">${esc(error.message)}</p>`;
    }
  };
  const authChanged = () => { if (alive) myScores(); };
  document.addEventListener("clarity:auth", authChanged);
  onLeave(() => document.removeEventListener("clarity:auth", authChanged));
  load(); myScores();
}

export function mountPublishPanel(parent, report, { api, esc, onPublished }) {
  const panel = document.createElement("div");
  panel.className = "score-publishing";
  parent.append(panel);
  if (!report.attemptId) {
    const note = report.offline ? "Offline feedback isn't eligible for the leaderboard."
      : report.demo || report.leaderboardStatus === "demo_excluded" ? "Sample demo pitches aren't eligible for the leaderboard."
      : report.leaderboardStatus === "save_failed" ? "Your report is ready, but its verified score couldn't be saved. Please try again later with a new pitch."
      : "Create an account or sign in before your next pitch to save a verified score. Your score stays private unless you choose to publish it.";
    panel.innerHTML = `<p class="small muted">${note}</p>${!report.offline && !report.demo && report.leaderboardStatus !== "save_failed" ? '<div class="actions" style="margin-top:12px"><a class="linkbtn" href="/sign-in">Sign in</a><a class="linkbtn" href="/sign-up">Create account</a></div>' : ""}`;
    return;
  }
  if (report.published) {
    panel.innerHTML = '<p class="small">Published. Only your public name, stage, score and input style are shown.</p>';
    return;
  }
  panel.innerHTML = `<form class="publish-form">
    <label>Public name <input class="field" name="publicName" required minlength="2" maxlength="40" autocomplete="nickname" placeholder="Choose a name, not your email"></label>
    <p class="small muted">Publishing makes your name, score, stage and input style public. Your transcript and detailed feedback remain private.</p>
    <button class="btn primary sm" type="submit">Publish this score</button><p class="small" role="status"></p>
  </form>`;
  const form = panel.querySelector("form");
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector("button"), status = form.querySelector('[role="status"]');
    button.disabled = true; status.textContent = "Publishing…";
    try {
      await api("/api/leaderboard/publish", { attemptId: report.attemptId, displayName: form.elements.publicName.value });
      if (!panel.isConnected) return;
      report.published = true;
      panel.innerHTML = '<p role="status">Published. You can remove your public scores from the leaderboard at any time.</p><a class="linkbtn" href="#/leaderboard">View leaderboard</a>';
      onPublished?.();
    } catch (error) { if (panel.isConnected) { button.disabled = false; status.textContent = error.message; } }
  };
}
