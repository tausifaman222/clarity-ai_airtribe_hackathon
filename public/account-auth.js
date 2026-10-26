const app = document.getElementById("auth-root");
const isRegistering = /^\/sign-up(\/|$)/.test(location.pathname);
const esc = value => String(value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
);

app.innerHTML = `<div class="auth-page">
  <a href="/" class="auth-back">← Back to Clarity AI</a>
  <section class="auth-card" aria-labelledby="accountTitle">
    <img src="/logo.svg" alt="Clarity AI: Speak confidently. Be understood." width="240" height="48">
    <p class="auth-kicker">${isRegistering ? "YOUR PRIVATE PRACTICE SPACE" : "WELCOME BACK"}</p>
    <h1 id="accountTitle">${isRegistering ? "Create your account" : "Sign in to your account"}</h1>
    <p class="muted">${isRegistering
      ? "Save your AI-reviewed scores privately. You choose if and when you publish a score."
      : "Sign in to see your saved scores. Your pitch reports stay private until you choose otherwise."}</p>
    <div id="googleBox"></div>
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
    <p class="account-switch">${isRegistering
      ? 'Already have an account? <a class="linkbtn" href="/sign-in">Sign in</a>'
      : 'New here? <a class="linkbtn" href="/sign-up">Create an account</a>'}</p>
    <p class="small muted account-safety">By continuing you agree to our <a class="linkbtn" href="/terms">Terms</a> and <a class="linkbtn" href="/privacy">Privacy policy</a>.</p>
    <p class="small muted account-safety">Want to explore first? <a class="linkbtn" href="/">Keep practising as a guest.</a> Guest reports aren't saved to your account.</p>
  </section>
</div>`;

// One "Continue with …" button per sign-in provider the server has keys for.
const LABELS = { google: "Google", github: "GitHub", linkedin: "LinkedIn", microsoft: "Microsoft" };
const ICONS = {
  google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z"/><path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.4 0-11.7-4.1-13.6-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>',
  github: '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
  linkedin: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path fill="#fff" d="M7.1 9.5H4.6V19h2.5V9.5zM5.9 5.3a1.45 1.45 0 100 2.9 1.45 1.45 0 000-2.9zM19.4 13.7c0-2.6-1.4-4.4-3.8-4.4-1.2 0-2 .6-2.4 1.3V9.5h-2.4V19h2.5v-4.9c0-1.3.5-2.3 1.8-2.3s1.7 1 1.7 2.3V19h2.6v-5.3z"/></svg>',
  microsoft: '<svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><path fill="#F25022" d="M0 0h10v10H0z"/><path fill="#7FBA00" d="M11 0h10v10H11z"/><path fill="#00A4EF" d="M0 11h10v10H0z"/><path fill="#FFB900" d="M11 11h10v10H11z"/></svg>',
};
const ERROR_TEXT = {
  unavailable: p => `${p} sign-in isn't set up on this server yet. Try another option.`,
  cancelled: p => `${p} sign-in was cancelled.`,
  expired: () => "That sign-in link expired. Please try again.",
  unverified: p => `Your ${p} email address isn't verified. Verify it with ${p}, then try again.`,
  linked_elsewhere: p => `That ${p} account is already connected to a different Clarity AI account. Sign out first to use it.`,
  failed: p => `${p} sign-in didn't work. Please try again.`,
};
const errorMessage = code => {
  const m = /^(google|github|linkedin|microsoft)_(\w+)$/.exec(code || "");
  return m && ERROR_TEXT[m[2]] ? ERROR_TEXT[m[2]](LABELS[m[1]]) : null;
};
const form = app.querySelector("#accountForm");
fetch("/api/health", { cache: "no-store" }).then(r => r.json()).then(h => {
  const list = (h.sso || (h.google ? ["google"] : [])).filter(p => LABELS[p]);
  if (!list.length) return;
  app.querySelector("#googleBox").innerHTML = `<div class="sso-list">${list.map(p =>
    `<a class="btn lg sso-btn sso-${p}" href="/auth/${p}">${ICONS[p]} Continue with ${LABELS[p]}</a>`).join("")}</div>
    <p class="auth-or"><span>or use a username</span></p>`;
}).catch(() => {});
const err = new URLSearchParams(location.search).get("error");
if (errorMessage(err)) setTimeout(() => { app.querySelector("#accountFeedback").textContent = errorMessage(err); }, 0);
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
