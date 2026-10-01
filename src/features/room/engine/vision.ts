import type { FaceLandmarker, PoseLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { SetupSample, VisionSample } from "@/lib/analysis/read";
import { leanFrom, movement, postureRatio, slouchFrom, trackedPoints } from "@/lib/analysis/posture";

/**
 * On-device perception with MediaPipe (face + pose landmarkers, WebAssembly/GPU).
 * Landmarks never leave the browser: each frame is reduced to a handful of derived
 * numbers (VisionSample) and the landmarks are discarded.
 *
 * Camera engagement and posture are estimated against a short "look at the lens"
 * calibration, because where the lens sits — and how each person sits — differs for
 * every setup. Posture maths lives in lib/analysis/posture.ts.
 */
const FACE_MODEL = process.env.NEXT_PUBLIC_MEDIAPIPE_FACE_MODEL ?? "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL = process.env.NEXT_PUBLIC_MEDIAPIPE_POSE_MODEL ?? "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface Calibration { yaw: number; pitch: number; irisX: number; irisY: number; posture: number | null; distance: number | null }

export interface Frame {
  face: boolean; yaw: number | null; pitch: number | null; irisX: number | null; irisY: number | null;
  /** Face distance from the camera per MediaPipe's face geometry; only used as a ratio against calibration. */
  distance: number | null;
  shoulderWidth: number | null; posture: number | null; midX: number | null; pts: number[] | null;
  faceX: number | null; faceY: number | null; faceSize: number | null;
}

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

const DEFAULT_CAL: Calibration = { yaw: 0, pitch: 0, irisX: 0.5, irisY: 0.45, posture: null, distance: null };

function median(xs: number[]) {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}

export class VisionTracker {
  private face: FaceLandmarker | null = null;
  private pose: PoseLandmarker | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastPts: number[] | null = null;
  private lastTs = 0;
  private canvas: HTMLCanvasElement | null = null;
  private frameCount = 0;
  private brightness: number | null = null;
  calibration: Calibration = { ...DEFAULT_CAL };
  calibrated = false;
  samples: VisionSample[] = [];
  lastFrame: Frame | null = null;
  ready = false;
  error: string | null = null;

  async init(): Promise<boolean> {
    try {
      const { FilesetResolver, FaceLandmarker, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/mediapipe");
      const make = async (delegate: "GPU" | "CPU") => Promise.all([
        FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate }, runningMode: "VIDEO", numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false }),
        PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: "VIDEO", numPoses: 1 }),
      ]);
      try {
        [this.face, this.pose] = await make("GPU");
      } catch {
        [this.face, this.pose] = await make("CPU");
      }
      this.ready = true;
      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  /** Run a still image through the same pipeline (used by the validation harness). */
  analyzeImage(img: HTMLImageElement | HTMLCanvasElement): Frame | null {
    if (!this.face || !this.pose) return null;
    if (img instanceof HTMLImageElement && (!img.complete || !img.naturalWidth)) return null;
    return this.run(img);
  }

  /** Run one frame through both models and reduce it to derived numbers. */
  analyze(video: HTMLVideoElement): Frame | null {
    if (!this.face || !this.pose || video.readyState < 2 || !video.videoWidth) return null;
    return this.run(video);
  }

  private run(video: Source): Frame | null {
    if (!this.face || !this.pose) return null;
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    const fr = this.face.detectForVideo(video, ts);
    const pr = this.pose.detectForVideo(video, ts);
    const lm = fr.faceLandmarks?.[0];
    const f: Frame = { face: !!lm, yaw: null, pitch: null, irisX: null, irisY: null, distance: null, shoulderWidth: null, posture: null, midX: null, pts: null, faceX: null, faceY: null, faceSize: null };
    if (lm && lm.length >= 478) {
      const m = fr.facialTransformationMatrixes?.[0]?.data;
      if (m) {
        f.yaw = (Math.asin(Math.max(-1, Math.min(1, -m[2]))) * 180) / Math.PI;
        f.pitch = (Math.atan2(m[6], m[10]) * 180) / Math.PI;
        // Translation z (column-major index 14): distance to the camera, unaffected by head rotation.
        f.distance = Math.abs(m[14]) || null;
      }
      const ratio = (c1: NormalizedLandmark, c2: NormalizedLandmark, iris: NormalizedLandmark) => {
        const dx = c2.x - c1.x, dy = c2.y - c1.y;
        const len2 = dx * dx + dy * dy || 1e-6;
        return ((iris.x - c1.x) * dx + (iris.y - c1.y) * dy) / len2;
      };
      const vr = (top: NormalizedLandmark, bottom: NormalizedLandmark, iris: NormalizedLandmark) => (iris.y - top.y) / ((bottom.y - top.y) || 1e-6);
      f.irisX = (ratio(lm[33], lm[133], lm[468]) + ratio(lm[362], lm[263], lm[473])) / 2;
      f.irisY = (vr(lm[159], lm[145], lm[468]) + vr(lm[386], lm[374], lm[473])) / 2;
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (const p of lm) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
      f.faceX = (minX + maxX) / 2;
      f.faceY = (minY + maxY) / 2;
      f.faceSize = (maxX - minX) * (maxY - minY);
    }
    const pl = pr.landmarks?.[0];
    if (pl && pl.length > 16 && (pl[11].visibility ?? 1) > 0.5 && (pl[12].visibility ?? 1) > 0.5) {
      const mid = { x: (pl[11].x + pl[12].x) / 2, y: (pl[11].y + pl[12].y) / 2 };
      f.shoulderWidth = Math.hypot(pl[11].x - pl[12].x, pl[11].y - pl[12].y);
      const [w, h] = video instanceof HTMLVideoElement ? [video.videoWidth, video.videoHeight] : video instanceof HTMLImageElement ? [video.naturalWidth, video.naturalHeight] : [video.width, video.height];
      f.posture = postureRatio(pl, w, h);
      f.midX = mid.x;
      f.pts = trackedPoints(pl, w, h);
    }
    this.frameCount++;
    if (this.frameCount % 8 === 1) this.brightness = this.measureBrightness(video);
    this.lastFrame = f;
    return f;
  }

  private measureBrightness(video: Source): number | null {
    try {
      this.canvas ??= document.createElement("canvas");
      this.canvas.width = 32;
      this.canvas.height = 18;
      const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, 32, 18);
      const d = ctx.getImageData(0, 0, 32, 18).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4);
    } catch {
      return null;
    }
  }

  /** Estimated 0..1 "looking at the lens", relative to calibration. */
  engagement(f: Frame): number | null {
    if (!f.face || f.yaw === null || f.pitch === null || f.irisX === null || f.irisY === null) return null;
    const c = this.calibration;
    const head = Math.exp(-(((f.yaw - c.yaw) / 12) ** 2) - (((f.pitch - c.pitch) / 10) ** 2));
    const eyes = Math.exp(-(((f.irisX - c.irisX) / 0.09) ** 2) - (((f.irisY - c.irisY) / 0.18) ** 2));
    return Math.max(0, Math.min(1, head * eyes));
  }

  toSample(f: Frame, t: number): VisionSample {
    const c = this.calibration;
    const motion = movement(this.lastPts, f.pts);
    this.lastPts = f.pts;
    const r3 = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);
    return {
      // Engagement is only estimated against the person's own lens calibration: a fixed
      // default baseline mis-read a head-covered face as "looking away" in validation
      // (docs/validation/camera-report.md), so uncalibrated sessions report nothing.
      t: Math.round(t), face: f.face, engaged: this.calibrated ? r3(this.engagement(f)) : null, yaw: r3(f.yaw), pitch: r3(f.pitch),
      lean: r3(leanFrom(f.distance, c.distance)),
      slouch: r3(slouchFrom(f.posture, c.posture, f.pitch !== null && this.calibrated ? f.pitch - c.pitch : null)),
      sway: r3(f.midX), motion: r3(motion), brightness: this.brightness === null ? null : Math.round(this.brightness),
    };
  }

  /** Collect frames while the user sits as they normally would and looks at the lens. */
  async calibrate(video: HTMLVideoElement, ms = 2200): Promise<boolean> {
    const frames: Frame[] = [];
    const end = performance.now() + ms;
    while (performance.now() < end) {
      const f = this.analyze(video);
      if (f) frames.push(f);
      await new Promise((r) => setTimeout(r, 100));
    }
    return this.calibrateFrom(frames);
  }

  /** Set the personal reference (gaze, posture, distance) from calibration frames. */
  calibrateFrom(frames: Frame[]): boolean {
    const faces = frames.filter((f) => f.face);
    if (faces.length < 5) return false;
    const pick = (k: keyof Frame) => median(faces.map((f) => f[k] as number).filter((v) => v !== null));
    const finite = (x: number) => (Number.isFinite(x) ? x : null);
    this.calibration = {
      yaw: pick("yaw") || 0, pitch: pick("pitch") || 0, irisX: pick("irisX") || 0.5, irisY: pick("irisY") || 0.45,
      posture: finite(pick("posture")), distance: finite(pick("distance")),
    };
    this.calibrated = true;
    return true;
  }

  /** Slouch can only be measured if shoulders and eyes were in view during calibration. */
  get postureReady(): boolean {
    return this.calibrated && this.calibration.posture !== null;
  }

  setupSample(micLevelDb: number | null, noiseFloorDb: number | null): SetupSample {
    const f = this.lastFrame;
    return { brightness: this.brightness === null ? null : Math.round(this.brightness), faceX: f?.faceX ?? null, faceY: f?.faceY ?? null, faceSize: f?.faceSize ?? null, micLevelDb, noiseFloorDb };
  }

  /** Sample ~4 times a second during the interview. */
  start(video: HTMLVideoElement, clock: () => number, intervalMs = 250) {
    this.stop();
    this.lastPts = null; // the device check also samples; don't count the jump to the first frame as movement
    this.timer = setInterval(() => {
      const f = this.analyze(video);
      if (f) this.samples.push(this.toSample(f, clock()));
    }, intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  drain(): VisionSample[] {
    return this.samples.splice(0);
  }

  close() {
    this.stop();
    this.face?.close();
    this.pose?.close();
  }
}
