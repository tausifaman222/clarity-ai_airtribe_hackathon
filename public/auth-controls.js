// Header account controls: first-party sessions (username/password or Google).
const roots = () => [...document.querySelectorAll("[data-auth-controls]")];
let healthPromise = null;
const health = () => (healthPromise ||= fetch("/api/health", { cache: "no-store" }).then(r => r.json()).catch(() => ({})));
const el = (tag, props = {}, text) => { const n = Object.assign(document.createElement(tag), props); if (text != null) n.textContent = text; return n; };

async function loadAccountControls() {
  const targets = roots();
  if (!targets.length) return;
  let user = null;
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) user = (await response.json()).user;
  } catch {}
  const h = await health();
  document.body.classList.toggle("signed-in", !!user);
  for (const target of roots()) {
    const controls = el("div", { className: "account-controls" });
    if (user) {
      if (user.avatarUrl) controls.append(el("img", { className: "avatar-img", src: user.avatarUrl, alt: "", width: 28, height: 28, referrerPolicy: "no-referrer" }));
      controls.append(el("a", { className: "small", href: "#/progress" }, `Hi, ${user.displayName?.split(" ")[0] || user.username}`));
      const button = el("button", { className: "btn sm", type: "button" }, "Sign out");
      button.onclick = async () => {
        button.disabled = true;
        try {
          const response = await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: "{}" });
          if (!response.ok) throw new Error();
          document.dispatchEvent(new Event("clarity:signout"));
          await loadAccountControls();
        } catch { button.disabled = false; button.textContent = "Try again"; }
      };
      controls.append(button);
    } else if (h.accounts !== false) {
      controls.append(el("a", { className: "btn sm", href: "/sign-in" }, "Sign in"));
      controls.append(el("a", { className: "btn sm primary", href: "/sign-up" }, "Create account"));
    }
    target.replaceChildren(controls);
  }
}

if (/^\/sign-(in|up)(\/|$)/.test(location.pathname)) {
  import("/account-auth.js");
} else {
  document.addEventListener("clarity:route", loadAccountControls);
  document.addEventListener("clarity:auth", loadAccountControls);
  loadAccountControls();
}
