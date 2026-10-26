import test from "node:test";
import assert from "node:assert/strict";

const KEYS = ["LLM_PROVIDER", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "FALLBACK_LLM_API_KEY", "FALLBACK_LLM_BASE_URL", "FALLBACK_LLM_MODEL"];
function withEnv(vars, fetchImpl) {
  const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  const realFetch = globalThis.fetch;
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  globalThis.fetch = fetchImpl;
  return () => { for (const k of KEYS) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; } globalThis.fetch = realFetch; };
}
const reply = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

test("falls back to the backup provider when the main one is rate-limited", async () => {
  const calls = [];
  const restore = withEnv({ LLM_PROVIDER: "groq", LLM_API_KEY: "gsk_main", FALLBACK_LLM_API_KEY: "AIza-backup" }, async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return String(url).includes("groq") ? new Response("rate limit", { status: 429 }) : reply('{"answer":"from gemini"}');
  });
  try {
    const { callLLMJson, aiStatus } = await import(`../llm.js?fb=${Date.now()}`);
    assert.equal(aiStatus().fallback, "gemini-flash-latest");
    assert.deepEqual(await callLLMJson("sys", "user"), { answer: "from gemini" });
    assert.match(calls[0].url, /api\.groq\.com/);
    assert.match(calls[1].url, /generativelanguage\.googleapis\.com/);
    assert.equal(calls[1].body.model, "gemini-flash-latest");
  } finally { restore(); }
});

test("does not fall back on a bad request, and uses max_completion_tokens for OpenAI", async () => {
  const calls = [];
  const restore = withEnv({ LLM_PROVIDER: "openai", LLM_API_KEY: "sk-main", LLM_MODEL: "gpt-5-mini", FALLBACK_LLM_API_KEY: "AIza-backup" }, async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response("bad request", { status: 400 });
  });
  try {
    const { callLLMJson } = await import(`../llm.js?nf=${Date.now()}`);
    await assert.rejects(callLLMJson("sys", "user"), /LLM 400/);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].body.max_completion_tokens && !calls[0].body.max_tokens);
  } finally { restore(); }
});

test("deep health check reports each provider separately", async () => {
  const restore = withEnv({ LLM_PROVIDER: "groq", LLM_API_KEY: "gsk_bad", FALLBACK_LLM_API_KEY: "AIza-backup" }, async url =>
    String(url).includes("groq") ? new Response("invalid api key", { status: 401 }) : reply('{"ok":true}'));
  try {
    const { llmHealth } = await import(`../llm.js?h=${Date.now()}`);
    const h = await llmHealth();
    assert.equal(h.ok, true);
    assert.equal(h.main.ok, false);
    assert.match(h.main.error, /key rejected/);
    assert.equal(h.fallback.ok, true);
  } finally { restore(); }
});
