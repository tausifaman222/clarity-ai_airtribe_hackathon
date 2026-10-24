// A genuine unavailable state, not a mock sign-in or an authentication bypass.
const signin = /^\/sign-(in|up)(\/|$)/.test(location.pathname);
if (signin) {
  const root = document.getElementById("auth-root");
  root.innerHTML = '<div class="auth-page"><img src="/logo.svg" alt="Clarity AI" width="180"><h1>Sign-in setup isn’t finished yet.</h1><p>Google sign-in is awaiting authentication setup. You can still practise as a guest.</p><a class="btn primary" href="/">Continue to practice</a></div>';
} else {
  const render = () => document.querySelectorAll("[data-auth-controls]").forEach(root => {
    root.innerHTML = '<a class="btn sm" href="/sign-in">Sign in with Google</a>';
  });
  document.addEventListener("clarity:route", render);
  render();
}
