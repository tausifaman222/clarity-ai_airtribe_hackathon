// The account controls use the app's first-party username/password sessions.
// Google SSO stays explicitly unavailable until its provider is configured.
const root = () => document.querySelector("[data-auth-controls]");

async function loadAccountControls() {
  const target = root();
  if (!target) return;
  target.replaceChildren();

  let user = null;
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) user = (await response.json()).user;
  } catch {}
  document.body.classList.toggle("signed-in", !!user);

  const controls = document.createElement("div");
  controls.className = "account-controls";
  if (user) {
    const greeting = document.createElement("span");
    greeting.className = "small";
    greeting.textContent = `Hi, ${user.username}`;
    controls.append(greeting);
    const button = document.createElement("button");
    button.className = "btn sm";
    button.type = "button";
    button.textContent = "Sign out";
    button.onclick = async () => {
      button.disabled = true;
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: "{}",
        });
        if (!response.ok) throw new Error();
        document.dispatchEvent(new Event("clarity:signout"));
        await loadAccountControls();
      } catch {
        button.disabled = false;
        button.textContent = "Try again";
      }
    };
    controls.append(button);
  } else {
    const login = document.createElement("a");
    login.className = "btn sm";
    login.href = "/sign-in";
    login.textContent = "Sign in";
    const register = document.createElement("a");
    register.className = "btn sm primary";
    register.href = "/sign-up";
    register.textContent = "Create account";
    controls.append(login, register);
  }
  const google = document.createElement("span");
  google.className = "google-coming-soon";
  google.setAttribute("aria-label", "Google sign-in coming soon");
  google.textContent = "Google · Coming soon";
  controls.append(google);
  target.replaceChildren(controls);
}

if (/^\/sign-(in|up)(\/|$)/.test(location.pathname)) {
  import("/account-auth.js");
} else {
  document.addEventListener("clarity:route", loadAccountControls);
  document.addEventListener("clarity:auth", loadAccountControls);
  loadAccountControls();
}
