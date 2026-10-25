// Recording + open-source Whisper transcription, for browsers without live speech recognition
// (Safari, Firefox, in-app browsers). Audio is sent once to our server, transcribed, and not stored.

export const recorderSupported = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function pickMime() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find(t => MediaRecorder.isTypeSupported?.(t)) || "";
}

export class Recorder {
  constructor({ onLevel } = {}) { this.onLevel = onLevel; this.chunks = []; this.level = 0; }
  get on() { return this.rec?.state === "recording"; }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mimeType = pickMime();
    this.rec = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24000 });
    this.chunks = []; this.startedAt = Date.now();
    this.rec.ondataavailable = e => { if (e.data?.size) this.chunks.push(e.data); };
    this.rec.start(1000);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      this.ctx = new Ctx(); const an = this.ctx.createAnalyser(); an.fftSize = 512;
      this.ctx.createMediaStreamSource(this.stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        if (!this.ctx) return;
        an.getByteTimeDomainData(buf); let s = 0;
        for (const v of buf) { const x = (v - 128) / 128; s += x * x; }
        this.level = this.level * 0.65 + Math.min(1, Math.sqrt(s / buf.length) * 5) * 0.35;
        this.onLevel?.(this.level); this.raf = requestAnimationFrame(tick);
      };
      tick();
    }
  }
  pause() { try { if (this.rec?.state === "recording") this.rec.pause(); } catch {} }
  resume() { try { if (this.rec?.state === "paused") this.rec.resume(); } catch {} }
  // Stops and returns the recording as one Blob.
  stop() {
    return new Promise(resolve => {
      const done = () => {
        cancelAnimationFrame(this.raf);
        try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
        try { this.ctx?.close(); } catch {}
        this.ctx = null; this.level = 0; this.onLevel?.(0);
        resolve(this.chunks.length ? new Blob(this.chunks, { type: (this.rec?.mimeType || "audio/webm").split(";")[0] }) : null);
      };
      if (!this.rec || this.rec.state === "inactive") return done();
      this.rec.onstop = done;
      try { this.rec.stop(); } catch { done(); }
    });
  }
}

export async function transcribe(blob, { lang, sid } = {}) {
  if (!blob || blob.size < 800) { const e = new Error("We couldn't hear anything. Try again a little closer to the mic."); e.status = 422; throw e; }
  const qs = new URLSearchParams({ ...(lang ? { lang } : {}), ...(sid ? { sid } : {}) });
  const res = await fetch(`/api/transcribe?${qs}`, { method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob });
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(data?.error || "Transcription failed."); e.status = res.status; throw e; }
  return data; // { text, segments: [{start, end, text}], duration }
}

// Dictation for small answer boxes (drills, follow-up questions): live recognition when available,
// otherwise record-then-transcribe with Whisper.
export function bindDictation(button, field, { SR, lang = () => "en-IN", whisper = false, toast, sid } = {}) {
  let rec = null, recorder = null, base = "";
  const label = button.innerHTML;
  const setOn = on => { button.classList.toggle("on", on); button.setAttribute("aria-pressed", String(on)); button.innerHTML = on ? "■ Stop" : label; };
  button.addEventListener("click", async () => {
    if (rec) { rec.stop(); return; }
    if (recorder) {
      const r = recorder; recorder = null; setOn(false); button.disabled = true; button.textContent = "Transcribing…";
      try { const out = await transcribe(await r.stop(), { lang: lang(), sid }); field.value = `${field.value} ${out.text}`.trim(); field.dispatchEvent(new Event("input")); }
      catch (e) { toast?.(e.message, "err"); }
      button.disabled = false; button.innerHTML = label; return;
    }
    if (SR) {
      rec = new SR(); rec.lang = lang(); rec.continuous = true; rec.interimResults = true; base = field.value ? `${field.value} ` : "";
      rec.onresult = e => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; field.value = (base + t).trim(); };
      rec.onend = () => { rec = null; setOn(false); field.dispatchEvent(new Event("input")); };
      rec.onerror = e => { if (e.error === "not-allowed") toast?.("Microphone access is blocked. Allow it in your browser, or type.", "err"); };
      try { rec.start(); setOn(true); } catch { rec = null; }
      return;
    }
    if (whisper && recorderSupported()) {
      try { recorder = new Recorder(); await recorder.start(); setOn(true); }
      catch { recorder = null; toast?.("Microphone access is blocked. Allow it in your browser, or type.", "err"); }
      return;
    }
    toast?.("Voice input isn't available in this browser. You can type instead.");
  });
  return () => { try { rec?.stop(); } catch {} recorder?.stop(); };
}
