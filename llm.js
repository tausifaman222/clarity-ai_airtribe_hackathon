// Provider-agnostic LLM calls over fetch (Node 18+). No SDK. Key stays server-side.
// Env:
//   LLM_API_KEY   (required for AI; ANTHROPIC_API_KEY / OPENAI_API_KEY / XAI_API_KEY also accepted)
//   LLM_PROVIDER  anthropic (default) | openai   (openai = any OpenAI-compatible API: OpenAI, xAI Grok, Groq, OpenRouter...)
//   LLM_MODEL     default claude-sonnet-5-5 for Anthropic; required for openai-compatible providers
//   LLM_BASE_URL  for openai-compatible providers, e.g. https://api.x.ai/v1 (default https://api.openai.com/v1)
const env = (k) => (process.env[k] || "").trim();

function config() {
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

export function aiStatus() {
  const c = config();
  const ready = !!c.key && !!c.model;
  return { ready, provider: c.provider, model: c.model || null,
    problem: !c.key ? "No LLM_API_KEY set" : !c.model ? "Set LLM_MODEL for this provider" : null };
}

async function callLLM(system, user, maxTokens, timeoutMs) {
  const c = config();
  if (!c.key || !c.model) throw new Error(aiStatus().problem);
  const signal = AbortSignal.timeout(timeoutMs);
  if (c.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: { "x-api-key": c.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  }
  // Groq's GPT-OSS models count reasoning tokens against the completion budget.
  const groqReasoning = new URL(c.baseUrl).hostname === "api.groq.com" && c.model.startsWith("openai/gpt-oss-");
  const res = await fetch(`${c.baseUrl}/chat/completions`, {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${c.key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: c.model, max_tokens: groqReasoning ? maxTokens + 4096 : maxTokens,
      ...(groqReasoning ? { reasoning_effort: "low" } : {}),
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
