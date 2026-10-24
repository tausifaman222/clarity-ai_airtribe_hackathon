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
    <span class="google-coming-soon auth-google" aria-label="Google sign-in coming soon">Google sign-in · Coming soon</span>
    <p class="account-switch">${isRegistering
      ? 'Already have an account? <a class="linkbtn" href="/sign-in">Sign in</a>'
      : 'New here? <a class="linkbtn" href="/sign-up">Create an account</a>'}</p>
    <p class="small muted account-safety">Want to explore first? <a class="linkbtn" href="/">Keep practising as a guest.</a> Guest reports aren't saved to your account.</p>
  </section>
</div>`;

const form = app.querySelector("#accountForm");
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
