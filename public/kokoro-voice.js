// Free, open-source voice that runs on the visitor's device: Kokoro-82M (Apache-2.0) via kokoro-js + Transformers.js.
// No key, no server, no usage limits. The model (~90 MB) downloads once from Hugging Face and is cached by the browser.
// Used when ElevenLabs isn't configured or fails; English only (other languages keep the browser voice).

const MODULE_URL = () => window.__KOKORO_URL || "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// Highest-graded Kokoro voices: af_heart (A) for the persona, am_michael (C+, clearest male) for the coach.
const VOICES = { meera: "af_heart", coach: "am_michael" };

let loading = null, engine = null, failed = false;

// Skip devices where a 90 MB download or on-device inference would hurt: data saver, slow networks, low memory.
export function kokoroSuitable(nav = navigator) {
  if (failed || window.__KOKORO_OFF) return false;
  const c = nav.connection;
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType || "")) return false;
  if (nav.deviceMemory && nav.deviceMemory < 4) return false;
  return typeof WebAssembly === "object";
}

export const kokoroReady = () => !!engine;

// Starts the download in the background; resolves when the voice is ready (or null if it can't run here).
export function warmKokoro() {
  if (engine) return Promise.resolve(engine);
  if (!kokoroSuitable()) return Promise.resolve(null);
  loading ||= (async () => {
    try {
      const { KokoroTTS } = await import(/* @vite-ignore */ MODULE_URL());
      const webgpu = !!navigator.gpu;
      engine = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: webgpu ? "fp32" : "q8", device: webgpu ? "webgpu" : "wasm" });
      return engine;
    } catch (e) {
      console.warn("Kokoro voice unavailable:", e?.message || e);
      failed = true; loading = null;
      return null;
    }
  })();
  return loading;
}

const mostlyLatin = t => { const s = String(t).replace(/[\s\d\p{P}]/gu, ""); return s && (s.match(/[A-Za-z]/g) || []).length / s.length > 0.9; };

// Returns an object URL for a WAV of the text, or null when Kokoro can't handle it (not ready, not English, too slow).
export async function kokoroSpeech(text, who = "coach", { timeoutMs = 12000 } = {}) {
  if (!engine || !mostlyLatin(text)) return null;
  const voice = VOICES[who] || VOICES.coach;
  const work = engine.generate(String(text).slice(0, 1200), { voice }).then(audio => URL.createObjectURL(audio.toBlob()));
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), timeoutMs));
  try { return await Promise.race([work, timeout]); } catch { return null; }
}
