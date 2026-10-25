const app = document.getElementById("auth-root");
const isRegistering = /^\/sign-up(\/|$)/.test(location.pathname);
const esc = value => String(value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
);

app.innerHTML = `<div class="auth-page">
  <a href="/" class="auth-back">← Back to Clarity AI</a>
  <section class="auth-card" aria-labelledby="accountTitle">
    <img src="/logo.svg" alt="Clarity AI" width="136">
    <p class="auth-kicker">${isRegistering ? "YOUR PRIVATE PRACTICE SPACE" : "WELCOME BACK"}</p>
    <h1 id="accountTitle">${isRegistering ? "Create your account" : "Sign in to your account"}</h1>
    <p class="muted">${isRegistering
      ? "Save your AI-reviewed scores privately. You choose if and when you publish a score."
      : "Sign in to see your saved scores. Your pitch reports stay private until you choose otherwise."}</p>
    <form id="accountForm" novalidate>
      <label class="account-field">Username
        <input class="field" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="24" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,23}" required placeholder="3–24 letters, numbers, . _ or -">
      </label>
      <label class="account-field">Password
        <input class="field" name="password" type="password" autocomplete="${isRegistering ? "new-password" : "current-password"}" ${isRegistering ? 'minlength="12" maxlength="128"' : 'maxlength="128"'} required placeholder="${isRegistering ? "At least 12 characters" : "Your password"}">
      </label>
      ${isRegistering ? `<label class="account-field">Confirm password
        <input class="field" name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required placeholder="Enter the same password again">
      </label>` : ""}
      <p class="account-feedback" id="accountFeedback" role="alert" aria-live="polite"></p>
      <button class="btn primary lg" type="submit">${isRegistering ? "Create account" : "Sign in"}</button>
    </form>
    <p class="small muted account-safety">We never store your password in readable form. <b>Password recovery isn't available yet</b>—without a recovery email, a lost password means you can't get back into that account.</p>
    <div id="googleBox"></div>
    <p class="account-switch">${isRegistering
      ? 'Already have an account? <a class="linkbtn" href="/sign-in">Sign in</a>'
      : 'New here? <a class="linkbtn" href="/sign-up">Create an account</a>'}</p>
    <p class="small muted account-safety">By continuing you agree to our <a class="linkbtn" href="/terms">Terms</a> and <a class="linkbtn" href="/privacy">Privacy policy</a>.</p>
    <p class="small muted account-safety">Want to explore first? <a class="linkbtn" href="/">Keep practising as a guest.</a> Guest reports aren't saved to your account.</p>
  </section>
</div>`;

const ERRORS = {
  google_unavailable: "Google sign-in isn't set up on this server yet. Use a username and password instead.",
  google_cancelled: "Google sign-in was cancelled.",
  google_expired: "That sign-in link expired. Please try again.",
  google_unverified: "Your Google email address isn't verified.",
  google_failed: "Google sign-in didn't work. Please try again.",
};
const form = app.querySelector("#accountForm");
fetch("/api/health", { cache: "no-store" }).then(r => r.json()).then(h => {
  if (!h.google) return;
  app.querySelector("#googleBox").innerHTML = `<a class="btn lg google-btn" href="/auth/google">
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z"/><path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.4 0-11.7-4.1-13.6-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
    Continue with Google</a><p class="auth-or"><span>or use a username</span></p>`;
}).catch(() => {});
const err = new URLSearchParams(location.search).get("error");
if (err && ERRORS[err]) setTimeout(() => { app.querySelector("#accountFeedback").textContent = ERRORS[err]; }, 0);
const feedback = app.querySelector("#accountFeedback");
form.elements.username.focus({ preventScroll: true });

form.addEventListener("submit", async event => {
  event.preventDefault();
  feedback.textContent = "";
  if (!form.reportValidity()) return;
  const data = {
    username: form.elements.username.value,
    password: form.elements.password.value,
    ...(isRegistering ? { confirmation: form.elements.confirmation.value } : {}),
  };
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = isRegistering ? "Creating your account…" : "Signing in…";
  try {
    const response = await fetch(isRegistering ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Couldn't sign in. Please try again.");
    form.reset();
    location.replace("/");
  } catch (error) {
    feedback.textContent = error.message === "Failed to fetch"
      ? "We couldn't reach Clarity AI. Check your connection and try again."
      : error.message || "Couldn't complete that request. Please try again.";
    button.disabled = false;
    button.textContent = isRegistering ? "Create account" : "Sign in";
  }
});
