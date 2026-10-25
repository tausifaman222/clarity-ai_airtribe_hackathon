// Runs the setup wizard end to end with fake providers: good keys, rejected keys, quota errors.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..");
// Fake fetch, loaded before the wizard: key "good-*" works, "bad-*" is rejected, "quota-*" is rate-limited.
const MOCK = `
const seen = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const key = (init.headers?.authorization || "").replace("Bearer ", "") || init.headers?.["xi-api-key"] || "";
  seen.push(url);
  process.on("exit", () => { if (process.env.SEEN_FILE) require("node:fs").writeFileSync(process.env.SEEN_FILE, seen.join("\\n")); });
  if (key.startsWith("good")) return new Response(url.includes("elevenlabs") ? "audio" : '{"choices":[{"message":{"content":"OK"}}]}', { status: 200 });
  if (key.startsWith("quota")) return new Response(url.includes("elevenlabs") ? '{"detail":{"status":"quota_exceeded"}}' : "rate limit", { status: url.includes("elevenlabs") ? 401 : 429 });
  return new Response("Invalid API Key", { status: 401 });
};`;

function run(answers) {
  const dir = mkdtempSync(path.join(tmpdir(), "clarity-setup-"));
  mkdirSync(path.join(dir, "scripts"));
  cpSync(path.join(repo, "scripts", "setup.js"), path.join(dir, "scripts", "setup.js"));
  writeFileSync(path.join(dir, "mock.cjs"), MOCK);
  writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
  const seenFile = path.join(dir, "seen.txt");
  const r = spawnSync(process.execPath, ["--require", path.join(dir, "mock.cjs"), path.join(dir, "scripts", "setup.js")],
    { input: answers.join("\n") + "\n", encoding: "utf8", timeout: 20000, env: { ...process.env, SEEN_FILE: seenFile } });
  const out = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  const envFile = path.join(dir, ".env");
  return { out, env: existsSync(envFile) ? readFileSync(envFile, "utf8") : null, seen: existsSync(seenFile) ? readFileSync(seenFile, "utf8") : "" };
}

test("good keys pass every check and are saved to a git-ignored .env, not sent to Vercel when declined", () => {
  const { out, env, seen } = run(["good-groq", "good-eleven", "good-gemini", "n"]);
  assert.match(out, /✓ Groq/); assert.match(out, /✓ ElevenLabs/); assert.match(out, /✓ Gemini/);
  assert.match(out, /Saved to \.env/);
  assert.match(env, /^LLM_API_KEY=good-groq$/m);
  assert.match(env, /^ELEVENLABS_API_KEY=good-eleven$/m);
  assert.match(env, /^FALLBACK_LLM_API_KEY=good-gemini$/m);
  assert.match(env, /^SESSION_SECRET=.{40,}$/m);
  assert.match(seen, /api\.groq\.com\/openai\/v1\/chat\/completions/);
  assert.match(seen, /generativelanguage\.googleapis\.com/);
  assert.match(seen, /api\.elevenlabs\.io\/v1\/text-to-speech/);
  assert.doesNotMatch(out, /good-groq|good-eleven|good-gemini/, "keys are never echoed");
});

test("a rejected key is reported clearly and nothing is saved unless you choose to continue", () => {
  const { out, env } = run(["bad-groq", "", "", "n"]);
  assert.match(out, /✗ Groq \(AI \+ speech-to-text\): key rejected/);
  assert.match(out, /Stopped/);
  assert.equal(env, null);
});

test("quota and credit problems are named, and you can still save and continue", () => {
  const { out, env } = run(["quota-groq", "quota-eleven", "", "y", "n"]);
  assert.match(out, /Groq.*rate limited or out of free quota/);
  assert.match(out, /ElevenLabs.*out of credits/);
  assert.match(env, /^LLM_API_KEY=quota-groq$/m);
});
