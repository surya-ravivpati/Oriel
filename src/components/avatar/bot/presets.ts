import type { BotPose } from "./draw";

/** Static poses for the expression sheet (design review / docs). The live engine blends toward similar targets. */
export const BASE_POSE: BotPose = {
  yaw: 0, roll: 0, bob: 0, scale: 1, gazeX: 0, gazeY: 0, open: 1, lidTopL: 0, lidTopR: 0,
  tiltL: 0, tiltR: 0, happy: 0, eyeScale: 1, voice: 0, blush: 0, glow: 1,
};

export const EXPRESSIONS: { name: string; pose: Partial<BotPose> }[] = [
  { name: "Idle", pose: {} },
  { name: "Listening", pose: { eyeScale: 1.02, gazeY: 0.05 } },
  { name: "Thinking", pose: { gazeX: 0.8, gazeY: -0.75, yaw: 0.18, roll: 0.05, lidTopL: 0.18, lidTopR: 0.18 } },
  { name: "Speaking", pose: { voice: 0.75, eyeScale: 1.04, bob: -0.008 } },
  { name: "Happy", pose: { happy: 0.6, blush: 0.35 } },
  { name: "Skeptical", pose: { tiltL: 0.8, tiltR: -0.3, lidTopL: 0.3, lidTopR: 0.1 } },
  { name: "Interrupting", pose: { open: 1.12, lidTopL: 0.12, lidTopR: 0.12, tiltL: 0.25, tiltR: 0.25, scale: 1.06, voice: 0.35 } },
  { name: "Watching panelist", pose: { gazeX: 0.85, yaw: 0.45 } },
  { name: "Blink", pose: { open: 0.08 } },
  { name: "High pressure", pose: { lidTopL: 0.2, lidTopR: 0.2 } },
];
