// Voice: ElevenLabs text-to-speech and open-source Whisper speech-to-text (via Groq or any OpenAI-compatible API).
// Keys stay on the server. Both are optional; the browser handles voice when they're missing.
import express from "express";

const express_raw = () => express.raw({ type: () => true, limit: "8mb" });
const env = k => (process.env[k] || "").trim();
const ELEVEN_BASE = () => (env("ELEVENLABS_BASE_URL") || "https://api.elevenlabs.io").replace(/\/+$/, "");
export const elevenKey = () => env("ELEVENLABS_API_KEY");

// Speech-to-text config: STT_* overrides, else reuse the Groq LLM key (Whisper is open source and free-tier friendly).
export function sttConfig() {
  const llmBase = env("LLM_BASE_URL").replace(/\/+$/, "");
  const groqLlm = /api\.groq\.com/.test(llmBase) || env("LLM_PROVIDER").toLowerCase() === "groq";
  const key = env("STT_API_KEY") || env("GROQ_API_KEY") || (groqLlm ? env("LLM_API_KEY") : "");
  const base = (env("STT_BASE_URL") || (key ? "https://api.groq.com/openai/v1" : "")).replace(/\/+$/, "");
  return { key, base, model: env("STT_MODEL") || "whisper-large-v3-turbo", ready: !!(key && base) };
}

// ---------- ElevenLabs ----------
const FALLBACK_VOICES = { coach: "pNInz6obpgDQGcFmaJgB", meera: "21m00Tcm4TlvDq8ikWAM" };
let voiceCache = null; // { coach, meera, at }
async function pickVoices(fetchImpl) {
  if (voiceCache && Date.now() - voiceCache.at < 6 * 3600e3) return voiceCache;
  const chosen = { coach: env("ELEVENLABS_VOICE_COACH"), meera: env("ELEVENLABS_VOICE_MEERA"), at: Date.now() };
  if (!chosen.coach || !chosen.meera) {
    try {
      const r = await fetchImpl(`${ELEVEN_BASE()}/v1/voices`, { headers: { "xi-api-key": elevenKey() }, signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const voices = (await r.json()).voices || [];
        const score = (v, gender) => (v.labels?.gender === gender ? 2 : 0) + (/indian|hindi/i.test(`${v.labels?.accent} ${v.labels?.language} ${v.name}`) ? 3 : 0);
        const best = gender => [...voices].sort((a, b) => score(b, gender) - score(a, gender))[0]?.voice_id;
        chosen.meera ||= best("female");
        chosen.coach ||= best("male");
      }
    } catch {}
  }
  chosen.coach ||= FALLBACK_VOICES.coach; chosen.meera ||= FALLBACK_VOICES.meera;
  return (voiceCache = chosen);
}

export async function synthesize(text, who, fetchImpl = (...a) => fetch(...a)) {
  const voices = await pickVoices(fetchImpl);
  const call = voiceId => fetchImpl(`${ELEVEN_BASE()}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { "xi-api-key": elevenKey(), "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: env("ELEVENLABS_MODEL") || "eleven_flash_v2_5" }),
  });
  let r = await call(voices[who]);
  if (!r.ok && (r.status === 400 || r.status === 404) && /voice/i.test(await r.clone().text())) {
    voiceCache = null; // the configured voice isn't available on this account; re-pick from the account's voices
    const fresh = await pickVoices(fetchImpl);
    if (fresh[who] !== voices[who]) r = await call(fresh[who]);
  }
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300);
    const e = new Error(`ElevenLabs ${r.status}: ${detail}`); e.status = r.status; e.detail = detail; throw e;
  }
  return Buffer.from(await r.arrayBuffer());
}

// ElevenLabs puts a machine-readable reason in detail.status, e.g. invalid_api_key or missing_permissions.
const elevenReason = d => { try { const j = JSON.parse(d).detail; return String(j?.status || j?.message || j).slice(0, 80); } catch { return d.slice(0, 80) || "no detail"; } };

// A real check, not just "a key is set": synthesises one short word, at most every 30 minutes.
let ttsCheck = null;
export async function voiceStatus(fetchImpl) {
  if (!elevenKey()) return { provider: "browser", ok: true, note: "ElevenLabs key not set; using the browser voice." };
  if (ttsCheck && Date.now() - ttsCheck.at < (ttsCheck.ok ? 30 : 5) * 60e3) return ttsCheck.result;
  let result;
  try { await synthesize("Hi.", "meera", fetchImpl); result = { provider: "elevenlabs", ok: true }; }
  catch (e) {
    const d = e.detail || "";
    const reason = e.status === 402 || /quota|credits/i.test(d) ? "ElevenLabs credits are used up."
      : /unusual_activity|free tier/i.test(d) ? "ElevenLabs blocked the free tier for this account."
      : e.status === 401 && /missing_permissions|permission/i.test(d) ? "This ElevenLabs key is restricted: edit it in ElevenLabs → API keys and allow Text to Speech and Voices (read)."
      : e.status === 401 ? `ElevenLabs rejected the API key (${elevenReason(d)}). Copy it again from ElevenLabs → API keys, with no spaces.`
      : `ElevenLabs error: ${e.message.slice(0, 160)}`;
    result = { provider: "elevenlabs", ok: false, error: reason, fallback: "browser" };
  }
  ttsCheck = { at: Date.now(), ok: result.ok, result };
  return result;
}

const ttsCache = new Map();
export function registerVoice(app, { rateLimit, track, fetchImpl = (...a) => fetch(...a) }) {
  app.post("/api/tts", rateLimit, async (req, res) => {
    if (!elevenKey()) return res.status(404).json({ error: "ElevenLabs not configured" });
    const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 1200) : "";
    const who = req.body?.voice === "meera" ? "meera" : "coach";
    if (!text) return res.status(400).json({ error: "No text" });
    const key = `${who}|${text}`;
    try {
      let buf = ttsCache.get(key);
      if (!buf) {
        buf = await synthesize(text, who, fetchImpl);
        ttsCache.set(key, buf);
        if (ttsCache.size > 80) ttsCache.delete(ttsCache.keys().next().value);
      }
      res.set({ "content-type": "audio/mpeg", "cache-control": "no-store" }).send(buf);
    } catch (e) { console.error("tts:", e.message); res.status(502).json({ error: "TTS unavailable" }); }
  });

  // Open-source Whisper transcription for browsers without live speech recognition (Safari, Firefox, some Android).
  const AUDIO_TYPES = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|m4a|x-m4a|aac)(;.*)?$/i;
  app.post("/api/transcribe", rateLimit, (req, res, next) => {
    const type = req.get("content-type") || "";
    if (!AUDIO_TYPES.test(type)) return res.status(415).json({ error: "Send the recording as audio (webm, ogg, mp4, wav or mp3)." });
    next();
  }, express_raw(), async (req, res) => {
    const c = sttConfig();
    if (!c.ready) return res.status(404).json({ error: "Transcription isn't configured on this server." });
    const audio = req.body;
    if (!Buffer.isBuffer(audio) || audio.length < 800) return res.status(422).json({ error: "We couldn't hear anything in that recording." });
    const type = (req.get("content-type") || "audio/webm").split(";")[0];
    const ext = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/aac": "aac" }[type] || "webm";
    const form = new FormData();
    form.append("file", new Blob([audio], { type }), `speech.${ext}`);
    form.append("model", c.model);
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");
    const lang = String(req.query.lang || "");
    // en-IN covers Hinglish, so let Whisper auto-detect; other languages get an explicit hint.
    if (/^[a-z]{2}-[A-Z]{2}$/.test(lang) && !lang.startsWith("en")) form.append("language", lang.slice(0, 2));
    // A short prompt nudges Whisper to keep Hinglish in Latin script instead of translating it.
    form.append("prompt", "Startup pitch in English, Hindi or Hinglish. Keep Hinglish words as spoken.");
    try {
      const r = await fetchImpl(`${c.base}/audio/transcriptions`, { method: "POST", body: form, headers: { authorization: `Bearer ${c.key}` }, signal: AbortSignal.timeout(55000) });
      if (!r.ok) throw new Error(`STT ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = await r.json();
      const segments = (Array.isArray(data.segments) ? data.segments : []).slice(0, 400)
        .map(s => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "").trim() })).filter(s => s.text);
      track?.("transcribe", req.query.sid);
      res.json({ text: String(data.text || "").trim(), segments, duration: Number(data.duration) || null });
    } catch (e) { console.error("transcribe:", e.message); res.status(502).json({ error: "Transcription is unavailable right now. You can type instead." }); }
  });
}
