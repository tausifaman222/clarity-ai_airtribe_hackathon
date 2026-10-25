// Provider-agnostic LLM calls over fetch (Node 18+). No SDK. Key stays server-side.
// Env:
//   LLM_API_KEY   (required for AI; ANTHROPIC_API_KEY / OPENAI_API_KEY / XAI_API_KEY also accepted)
//   LLM_PROVIDER  groq | gemini | openrouter (presets) | anthropic (default) | openai (any OpenAI-compatible API)
//   LLM_MODEL     default claude-sonnet-5-5 for Anthropic; required for openai-compatible providers
//   LLM_BASE_URL  for openai-compatible providers, e.g. https://api.x.ai/v1 (default https://api.openai.com/v1)
//   FALLBACK_LLM_API_KEY / FALLBACK_LLM_BASE_URL / FALLBACK_LLM_MODEL  optional OpenAI-compatible backup, used
//                 automatically when the main provider is rate-limited, down, times out or is unconfigured.
const env = (k) => (process.env[k] || "").trim();

// One-word presets for open-model and free-tier providers.
const PRESETS = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", keyEnv: "GROQ_API_KEY" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", keyEnv: "GEMINI_API_KEY" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "", keyEnv: "OPENROUTER_API_KEY" },
};
function config() {
  const preset = PRESETS[env("LLM_PROVIDER").toLowerCase()];
  if (preset) {
    return { key: env("LLM_API_KEY") || env(preset.keyEnv), provider: "openai",
      baseUrl: (env("LLM_BASE_URL") || preset.baseUrl).replace(/\/+$/, ""), model: env("LLM_MODEL") || preset.model };
  }
  const key = env("LLM_API_KEY") || env("ANTHROPIC_API_KEY") || env("OPENAI_API_KEY") || env("XAI_API_KEY");
  let provider = env("LLM_PROVIDER").toLowerCase();
  let baseUrl = env("LLM_BASE_URL").replace(/\/+$/, "");
  if (!provider) {
    if (baseUrl || key.startsWith("xai-") || (key.startsWith("sk-") && !key.startsWith("sk-ant-")) || (!env("LLM_API_KEY") && !env("ANTHROPIC_API_KEY") && (env("OPENAI_API_KEY") || env("XAI_API_KEY")))) provider = "openai";
    else provider = "anthropic";
  }
  if (provider === "openai" && !baseUrl) baseUrl = key.startsWith("xai-") || (!env("OPENAI_API_KEY") && env("XAI_API_KEY")) ? "https://api.x.ai/v1" : "https://api.openai.com/v1";
  const model = env("LLM_MODEL") || (provider === "anthropic" ? "claude-sonnet-5-5" : "");
  return { key, provider, baseUrl, model };
}

function fallbackConfig() {
  const key = env("FALLBACK_LLM_API_KEY");
  const baseUrl = (env("FALLBACK_LLM_BASE_URL") || (key.startsWith("AIza") ? PRESETS.gemini.baseUrl : "")).replace(/\/+$/, "");
  const model = env("FALLBACK_LLM_MODEL") || (baseUrl === PRESETS.gemini.baseUrl ? PRESETS.gemini.model : "");
  return key && baseUrl && model ? { key, provider: "openai", baseUrl, model } : null;
}

export function aiStatus() {
  const c = config(), fb = fallbackConfig();
  const primary = !!c.key && !!c.model;
  return { ready: primary || !!fb, provider: c.provider, model: c.model || null, fallback: fb ? fb.model : null,
    problem: primary ? null : fb ? "Main provider not configured; using the fallback" : !c.key ? "No LLM_API_KEY set" : "Set LLM_MODEL for this provider" };
}

// Errors worth retrying on the backup provider: rate limits, server errors, timeouts, network failures.
const retryable = e => !e.status || e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500 || e.status === 401 || e.status === 403;

async function callLLM(system, user, maxTokens, timeoutMs) {
  const c = config(), fb = fallbackConfig();
  const primary = c.key && c.model;
  if (!primary && !fb) throw new Error(aiStatus().problem);
  if (!primary) return callProvider(fb, system, user, maxTokens, timeoutMs);
  try { return await callProvider(c, system, user, maxTokens, timeoutMs); }
  catch (e) {
    if (!fb || !retryable(e)) throw e;
    console.warn(`llm: main provider failed (${e.message.slice(0, 120)}); trying fallback ${fb.model}`);
    return callProvider(fb, system, user, maxTokens, timeoutMs);
  }
}

async function callProvider(c, system, user, maxTokens, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  const fail = async (label, res) => { const e = new Error(`${label} ${res.status}: ${(await res.text()).slice(0, 300)}`); e.status = res.status; return e; };
  if (c.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: { "x-api-key": c.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw await fail("Anthropic", res);
    const data = await res.json();
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  }
  // Groq's GPT-OSS models count reasoning tokens against the completion budget.
  const host = new URL(c.baseUrl).hostname;
  const groqReasoning = host === "api.groq.com" && c.model.startsWith("openai/gpt-oss-");
  // OpenAI's newer models reject max_tokens; everyone else still expects it.
  const budget = groqReasoning ? maxTokens + 4096 : maxTokens;
  const res = await fetch(`${c.baseUrl}/chat/completions`, {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${c.key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: c.model, ...(host === "api.openai.com" ? { max_completion_tokens: budget } : { max_tokens: budget }),
      ...(groqReasoning ? { reasoning_effort: "low" } : {}),
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw await fail("LLM", res);
  return (await res.json()).choices?.[0]?.message?.content || "";
}

// Defensive parse: strip code fences, take the outermost {...}, JSON.parse in try/catch.
export function parseJson(text) {
  const t = String(text || "").replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("No JSON object in reply");
  return JSON.parse(t.slice(a, b + 1));
}

// Strict JSON with exactly one retry ("Return only valid JSON.").
export async function callLLMJson(system, user, { maxTokens = 1000, timeoutMs = 30000 } = {}) {
  const first = await callLLM(system, user, maxTokens, timeoutMs);
  try { return parseJson(first); } catch {
    const retry = await callLLM(system, `${user}\n\nReturn only valid JSON.`, maxTokens, timeoutMs);
    return parseJson(retry);
  }
}

// A real check, not just "a key is set": one tiny call per provider, cached (10 min if fine, 2 min if failing).
let llmCheck = null;
export async function llmHealth() {
  if (llmCheck && Date.now() - llmCheck.at < (llmCheck.ok ? 10 : 2) * 60e3) return llmCheck.result;
  const probe = async c => {
    if (!c) return null;
    const started = Date.now();
    try {
      const out = parseJson(await callProvider(c, 'Reply with JSON only.', 'Return {"ok":true}', 50, 20000));
      return { model: c.model, ok: out.ok === true, ms: Date.now() - started };
    } catch (e) {
      const why = e.status === 401 || e.status === 403 ? "key rejected" : e.status === 429 ? "rate limited or out of quota" : e.status === 404 ? "model not found" : e.name === "TimeoutError" ? "timed out" : "error";
      return { model: c.model, ok: false, error: `${why}: ${e.message.slice(0, 160)}` };
    }
  };
  const c = config();
  const [main, fallback] = await Promise.all([probe(c.key && c.model ? c : null), probe(fallbackConfig())]);
  const result = { ok: !!(main?.ok || fallback?.ok), main, fallback };
  llmCheck = { at: Date.now(), ok: result.ok, result };
  return result;
}
