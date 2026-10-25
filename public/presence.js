// Camera coach: on-device body-language analysis with Google's open-source MediaPipe (face + pose landmarks).
// Video never leaves the browser. Only summary numbers (eye contact %, posture %, ...) are sent with the pitch.
import { faceFeatures, poseFeatures, createPresenceTracker } from "./presence-metrics.js";

const VISION_VERSION = "0.10.35";
const VISION_BASE = window.__CLARITY_VISION_BASE || `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}`;
const FACE_MODEL = window.__CLARITY_FACE_MODEL || "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL = window.__CLARITY_POSE_MODEL || "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let visionPromise = null;
async function loadVision() {
  visionPromise ||= (async () => {
    const vision = await import(/* @vite-ignore */ `${VISION_BASE}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${VISION_BASE}/wasm`);
    const make = async (Task, opts) => {
      try { return await Task.createFromOptions(files, { ...opts, baseOptions: { ...opts.baseOptions, delegate: "GPU" } }); }
      catch { return Task.createFromOptions(files, { ...opts, baseOptions: { ...opts.baseOptions, delegate: "CPU" } }); }
    };
    const [face, pose] = await Promise.all([
      make(vision.FaceLandmarker, { baseOptions: { modelAssetPath: FACE_MODEL }, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true }),
      make(vision.PoseLandmarker, { baseOptions: { modelAssetPath: POSE_MODEL }, runningMode: "VIDEO", numPoses: 1 }),
    ]);
    return { face, pose };
  })();
  try { return await visionPromise; } catch (e) { visionPromise = null; throw e; }
}

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia && typeof WebAssembly === "object";

export class PresenceCoach {
  constructor({ video, onNudge, onStatus }) {
    this.video = video; this.onNudge = onNudge; this.onStatus = onStatus;
    this.tracker = createPresenceTracker(); this.running = false; this.paused = false; this.lastTs = 0;
  }
  async start() {
    this.onStatus?.("loading", "Starting your camera…");
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
    this.video.srcObject = this.stream; this.video.muted = true; this.video.playsInline = true;
    await this.video.play().catch(() => {});
    this.onStatus?.("loading", "Loading the on-device body-language model (first time only)…");
    this.models = await loadVision();
    this.running = true; this.onStatus?.("on", "Camera coach is on. Video stays on your device.");
    this.loop();
  }
  loop() {
    if (!this.running) return;
    const step = () => {
      if (!this.running) return;
      const now = performance.now();
      if (!this.paused && now - this.lastTs > 100 && this.video.readyState >= 2) { // ~10 fps is plenty
        this.lastTs = now;
        try {
          const f = this.models.face.detectForVideo(this.video, now);
          const p = this.models.pose.detectForVideo(this.video, now);
          const face = faceFeatures(f?.faceLandmarks?.[0], f?.faceBlendshapes?.[0]?.categories);
          const pose = poseFeatures(p?.landmarks?.[0]);
          this.tracker.add(face, pose);
          const n = this.tracker.nudge(); if (n) this.onNudge?.(n);
        } catch (e) { /* skip a bad frame */ }
      }
      this.raf = (this.video.requestVideoFrameCallback ? this.video.requestVideoFrameCallback(step) : requestAnimationFrame(step));
    };
    step();
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  summary() { return this.tracker.summary(); }
  stop() {
    this.running = false;
    try { this.video.cancelVideoFrameCallback?.(this.raf); cancelAnimationFrame(this.raf); } catch {}
    try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
    if (this.video) this.video.srcObject = null;
    this.stream = null;
  }
}
