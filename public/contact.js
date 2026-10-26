// Contact page: fetch a one-time human check, then exchange it (with the visitor's name and reason) for a WhatsApp link.
const form = document.getElementById("contactForm");
const feedback = document.getElementById("contactFeedback");
const question = document.getElementById("question");
const button = form.querySelector("button");
let token = null, turnstileToken = null;

async function load() {
  try {
    const c = await (await fetch("/api/contact", { cache: "no-store" })).json();
    if (!c.enabled) { form.hidden = true; feedback.textContent = "Contact isn't set up yet. Please try again later."; form.after(feedback); return; }
    document.getElementById("contactTitle").textContent = `Message ${c.name} on WhatsApp`;
    token = c.token; question.textContent = `Quick check: ${c.question}`;
    form.answer.value = "";
    if (c.turnstileSiteKey && !window.turnstile) {
      window.onTurnstile = () => window.turnstile.render("#turnstile", { sitekey: c.turnstileSiteKey, callback: t => { turnstileToken = t; } });
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstile"; s.async = true; document.head.append(s);
    }
  } catch { feedback.textContent = "We couldn't load the form. Check your connection and refresh."; }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  feedback.textContent = "";
  const data = Object.fromEntries(new FormData(form));
  if (data.name.trim().length < 2 || data.reason.trim().split(/\s+/).length < 3) { feedback.textContent = "Please add your name and a short reason (at least a few words)."; return; }
  if (!data.answer.trim()) { feedback.textContent = "Please answer the quick check."; form.answer.focus(); return; }
  button.disabled = true; button.textContent = "Checking…";
  try {
    const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, token, turnstile: turnstileToken }) });
    const out = await r.json();
    if (!r.ok) {
      feedback.textContent = out.message || "Something went wrong. Please try again.";
      if (["wrong_answer", "expired", "too_fast", "bot"].includes(out.error)) { await load(); window.turnstile?.reset?.(); }
      return;
    }
    feedback.style.color = "var(--accent)"; feedback.textContent = "Verified. Opening WhatsApp…";
    location.href = out.url;
  } catch { feedback.textContent = "We couldn't reach the server. Please try again."; }
  finally { button.disabled = false; button.textContent = "Continue to WhatsApp"; }
});

load();
