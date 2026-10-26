#!/usr/bin/env node
// Clarity AI setup wizard: `npm run setup`
// Asks for your keys on YOUR computer, saves them to .env (git-ignored, never committed) and can send them
// straight to Vercel, create the database tables, deploy, and check that every key really works.
// Nothing is sent anywhere except your own Vercel project and the AI/voice providers' health checks.
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(root, ".env");
const say = (s = "") => process.stdout.write(s + "\n");
const bold = s => `\x1b[1m${s}\x1b[0m`, green = s => `\x1b[32m${s}\x1b[0m`, red = s => `\x1b[31m${s}\x1b[0m`, dim = s => `\x1b[2m${s}\x1b[0m`;

// ---------- prompts (secret input is hidden) ----------
const tty = !!process.stdin.isTTY;
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
let muted = false;
if (tty) rl._writeToOutput = s => { if (!muted) rl.output.write(s); };
// Queue lines so answers piped in all at once (or typed ahead) are never lost.
const lines = [], waiting = [];
rl.on("line", l => (waiting.length ? waiting.shift()(l) : lines.push(l)));
rl.on("close", () => { while (waiting.length) waiting.shift()(""); });
const nextLine = () => new Promise(r => (lines.length ? r(lines.shift()) : waiting.push(r)));
async function ask(q, { secret = false, fallback = "" } = {}) {
  const hint = fallback ? dim(secret ? " [keep current, press Enter]" : ` [${fallback}]`) : "";
  process.stdout.write(`${q}${hint}: `);
  muted = secret && tty;
  const a = (await nextLine()).trim();
  muted = false;
  if (secret || !tty) process.stdout.write("\n");
  return a || fallback;
}
const yes = async (q, def = true) => /^y/i.test(await ask(`${q} (${def ? "Y/n" : "y/N"})`, { fallback: def ? "y" : "n" }));

// ---------- .env helpers ----------
const parseEnv = text => Object.fromEntries(text.split(/\r?\n/).map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, "$2")]));
const current = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, "utf8")) : {};
function writeEnv(vars) {
  const merged = { ...current, ...vars };
  const body = Object.entries(merged).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("\n");
  writeFileSync(ENV_FILE, `# Written by npm run setup. Never commit this file (it is in .gitignore).\n${body}\n`, { mode: 0o600 });
}

// ---------- Vercel CLI ----------
const isWin = process.platform === "win32";
const vercel = (args, opts = {}) => spawnSync(isWin ? "npx.cmd" : "npx", ["--yes", "vercel@latest", ...args], { cwd: root, shell: isWin, encoding: "utf8", ...opts });

async function checkKeys(vars) {
  say(bold("\nChecking your keys with a tiny real call to each provider..."));
  const results = [];
  const tryCall = async (name, fn) => { try { results.push([name, await fn()]); } catch (e) { results.push([name, `could not reach (${e.message})`]); } };
  // A real one-word chat call proves the key, the model and the quota, not just that the key exists.
  const chat = async (base, key, model) => {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(25000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 200, messages: [{ role: "user", content: "Say OK." }] }),
    });
    if (r.ok) return true;
    const t = (await r.text()).slice(0, 160).replace(/\s+/g, " ");
    return r.status === 401 || r.status === 403 || (r.status === 400 && /api key|API_KEY/i.test(t)) ? "key rejected"
      : r.status === 429 ? "rate limited or out of free quota (try again in a minute)"
      : r.status === 404 ? `model ${model} not available on this key` : `error ${r.status}: ${t}`;
  };
  if (vars.LLM_API_KEY) await tryCall("Groq (AI + speech-to-text)", () => chat("https://api.groq.com/openai/v1", vars.LLM_API_KEY, "openai/gpt-oss-120b"));
  if (vars.FALLBACK_LLM_API_KEY) await tryCall("Gemini (backup AI)", () => chat(vars.FALLBACK_LLM_BASE_URL, vars.FALLBACK_LLM_API_KEY, vars.FALLBACK_LLM_MODEL));
  if (vars.ELEVENLABS_API_KEY) await tryCall("ElevenLabs (voice)", async () => {
    const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM?output_format=mp3_44100_64", {
      method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "xi-api-key": vars.ELEVENLABS_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ text: "Hi.", model_id: "eleven_flash_v2_5" }),
    });
    if (r.ok) return true;
    if (r.status === 404 && (await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": vars.ELEVENLABS_API_KEY } })).ok) return true; // key fine; app picks a voice from your library
    const t = (await r.text()).slice(0, 200);
    return /quota|credit/i.test(t) ? "out of credits"
      : /unusual_activity|free tier/i.test(t) ? "ElevenLabs blocked the free tier for this account (a paid plan or another account fixes it)"
      : /missing_permissions/i.test(t) ? "key is restricted: allow Text to Speech and Voices (read) in ElevenLabs → API keys"
      : r.status === 401 ? `key rejected (${t})` : `error ${r.status}: ${t}`;
  });
  for (const [name, ok] of results) say(`  ${ok === true ? green("✓") : red("✗")} ${name}${ok === true ? "" : `: ${ok}`}`);
  return results.every(([, ok]) => ok === true);
}

function migrate(databaseUrl) {
  say(bold("\nCreating the database tables..."));
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "migrate.js")], { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: databaseUrl } });
  say(r.status === 0 ? green("  ✓ Database is ready.") : red(`  ✗ ${(r.stderr || r.stdout).trim().split("\n").pop()}`));
  return r.status === 0;
}

// ---------- main ----------
async function main() {
  say(bold("\nClarity AI setup\n"));
  say("Your keys stay on this computer and in your own hosting account. They are never committed to GitHub.\n");
  say(`Get keys here (all free):
  Groq        https://console.groq.com/keys       ${dim("(required: AI + speech-to-text)")}
  ElevenLabs  https://elevenlabs.io/app/settings/api-keys  ${dim("(optional: natural voices)")}
  Gemini      https://aistudio.google.com/apikey  ${dim("(optional: backup AI)")}\n`);

  const vars = { LLM_PROVIDER: "groq" };
  vars.LLM_API_KEY = await ask("Groq API key", { secret: true, fallback: current.LLM_API_KEY });
  if (!vars.LLM_API_KEY) say(dim("  No AI key: the app will run in offline (keyword) mode."));
  vars.ELEVENLABS_API_KEY = await ask("ElevenLabs API key (Enter to skip)", { secret: true, fallback: current.ELEVENLABS_API_KEY });
  vars.FALLBACK_LLM_API_KEY = await ask("Gemini API key for backup (Enter to skip)", { secret: true, fallback: current.FALLBACK_LLM_API_KEY });
  if (vars.FALLBACK_LLM_API_KEY) Object.assign(vars, { FALLBACK_LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai", FALLBACK_LLM_MODEL: "gemini-flash-latest" });
  vars.SESSION_SECRET = current.SESSION_SECRET || randomBytes(36).toString("base64url");
  say(dim("  Session secret generated automatically."));

  const keysOk = await checkKeys(vars);
  if (!keysOk && !(await yes("Some keys failed. Continue anyway?", false))) return say("Stopped. Fix the key and run npm run setup again.");

  writeEnv(vars);
  say(green(`\n✓ Saved to .env`) + dim(" (git-ignored). You can now run the app locally with npm start."));

  const toVercel = await yes("\nSend these keys to Vercel and deploy now?");
  rl.close(); // the Vercel CLI needs the keyboard from here on
  if (!toVercel) {
    say(`\nFor Replit, Render or another host, add the same names and values from .env in its Secrets / Environment page.`);
    return;
  }

  say(bold("\nConnecting this folder to your Vercel project") + dim(" (a browser window may open to sign in; choose your existing project if asked)..."));
  if (vercel(["link"], { stdio: "inherit" }).status !== 0) return say(red("Couldn't link to Vercel. Run `npx vercel link` yourself, then npm run setup again."));

  say(bold("\nSaving keys to Vercel (Production)..."));
  for (const [k, v] of Object.entries(vars)) {
    if (!v) continue;
    vercel(["env", "rm", k, "production", "--yes"]);                     // replace if it already exists
    const r = vercel(["env", "add", k, "production"], { input: v });
    say(`  ${r.status === 0 ? green("✓") : red("✗")} ${k}${r.status === 0 ? "" : `: ${(r.stderr || "").trim().split("\n").pop()}`}`);
  }

  // Use the database Vercel/Neon connected to the project, if any.
  const pulled = path.join(root, ".env.vercel-pull");
  vercel(["env", "pull", pulled, "--environment=production", "--yes"]);
  const remote = existsSync(pulled) ? parseEnv(readFileSync(pulled, "utf8")) : {};
  if (existsSync(pulled)) unlinkSync(pulled);
  const db = remote.DATABASE_URL || remote.POSTGRES_URL || current.DATABASE_URL;
  if (db) migrate(db);
  else say(`\n${bold("No database yet.")} In Vercel: project → Storage → Create → Neon (Free) → connect. Then run npm run setup again.\n${dim("The app still works without it; only sign-in and saved history need the database.")}`);

  say(bold("\nDeploying to production..."));
  const d = vercel(["--prod", "--yes"], { stdio: ["inherit", "pipe", "inherit"] });
  const url = (d.stdout || "").match(/https:\/\/[^\s]+\.vercel\.app/g)?.pop();
  if (d.status !== 0 || !url) return say(red("Deploy didn't finish. Check the Vercel dashboard for the build log."));
  say(green(`  ✓ Live at ${url}`));

  say(bold("\nChecking the live app..."));
  try {
    const h = await (await fetch(`${url}/api/health?deep=1`, { signal: AbortSignal.timeout(45000) })).json();
    const line = (ok, label, why = "") => say(`  ${ok ? green("✓") : red("✗")} ${label}${ok || !why ? "" : `: ${why}`}`);
    line(h.ai && h.llm?.ok !== false, "AI", h.llm?.main?.error || h.problem);
    line(h.voice?.ok && h.voice?.provider === "elevenlabs", "ElevenLabs voice", h.voice?.error || "using the browser voice");
    line(h.stt === "whisper", "Whisper speech-to-text");
    line(h.accounts, "Accounts and history", "connect a Neon database, then run setup again");
  } catch (e) { say(red(`  Couldn't reach ${url}/api/health yet (${e.message}). Try opening it in a minute.`)); }
  say(`\nDone. Open ${url} and try a practice.`);
}

main().catch(e => say(red(`\nSetup failed: ${e.message}`))).finally(() => { try { rl.close(); } catch {} });
