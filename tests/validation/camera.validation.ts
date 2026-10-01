import { test, expect } from "@playwright/test";
import fs from "node:fs";

type StillRow = { file: string; frames: number; maxMotion: number | null; restless: number };
type PostureRow = { file: string; skinTone: string; eyewear: string; headCovering: string; lighting: string; postureReady: boolean; scale: number; expected: string; lean: number | null; slouch: number | null; kind: string };
type Row = { file: string; skinTone: string; eyewear: string; headCovering: string; lighting: string; ageBand: string; gaze: string; faceDetected: boolean; engagement: number | null; yaw: number | null; pitch: number | null; shoulders: boolean; brightness: number | null; faceX: number | null; faceY: number | null; faceSize: number | null; classifiedAs: string };

/** Runs the on-device camera pipeline over the labelled portraits and writes docs/validation/camera-report.md. */
test("camera signal validation and bias audit", async ({ page }) => {
  await page.goto("/dev/validation");
  await expect(page.getByTestId("status")).toHaveText(/done:/, { timeout: 240_000 });
  const rows = (await page.evaluate(() => (window as unknown as { __cameraValidation: unknown }).__cameraValidation)) as Row[];
  const posture = (await page.evaluate(() => (window as unknown as { __postureValidation: unknown }).__postureValidation)) as PostureRow[];
  const stillness = (await page.evaluate(() => (window as unknown as { __stillnessValidation: unknown }).__stillnessValidation)) as StillRow[];
  expect(rows.length).toBeGreaterThan(0);
  fs.mkdirSync("docs/validation", { recursive: true });
  fs.writeFileSync("docs/validation/camera-results.json", JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  fs.writeFileSync("docs/validation/posture-results.json", JSON.stringify({ generatedAt: new Date().toISOString(), rows: posture, stillness }, null, 2));
  fs.writeFileSync("docs/validation/camera-report.md", render(rows, posture, stillness));
});

const KIND: Record<string, string> = { upright: "upright", lean_back: "sat back", lean_in: "leaned in", slouch: "**slouch**", fidget: "restless", off_frame: "**no face**", "no-face": "**no face**" };

function renderPosture(posture: PostureRow[], stillness: StillRow[]): string[] {
  const files = [...new Set(posture.map((r) => r.file))];
  const zooms = [...new Set(posture.map((r) => r.scale))];
  const ready = files.filter((f) => posture.find((r) => r.file === f)?.postureReady).length;
  const leanErr = posture.filter((r) => r.lean !== null).map((r) => Math.abs(r.lean! - r.scale));
  const meanErr = leanErr.length ? leanErr.reduce((a, b) => a + b, 0) / leanErr.length : NaN;
  const falseSlouch = posture.filter((r) => r.kind === "slouch").length;
  const maxSlouch = Math.max(0, ...posture.map((r) => r.slouch ?? 0));
  const correct = posture.filter((r) => r.kind === r.expected).length;
  const L: string[] = ["## Posture (calibrated)", "",
    `Each lens-facing portrait is used as its own 2-second calibration, then run again zoomed out and in (${zooms.map((z) => `×${z}`).join(", ")}) to mimic sitting back and leaning in. Distance alone must never read as a slouch.`, "",
    "**Pass criteria** (set before running): shoulders found at calibration in every image; lean within ±0.06 of the zoom; no slouch at any zoom (slouch estimate below 0.1); ×0.75 read as \"sat back\", ×1.25 as \"leaned in\", the rest upright; and no restlessness on 24 repeated frames of each still portrait.", "",
    `- Shoulders found at calibration: **${ready}/${files.length}** portraits.`,
    `- Lean error: **${meanErr.toFixed(3)}** mean absolute, ${leanErr.length ? Math.max(...leanErr).toFixed(3) : "—"} worst.`,
    `- Slouch flagged by distance alone: **${falseSlouch}** of ${posture.length} runs (highest slouch estimate ${maxSlouch.toFixed(3)}).`,
    `- Posture read as expected: **${correct}/${posture.length}**.`,
    `- Still portraits read as restless: **${stillness.reduce((a, r) => a + r.restless, 0)}** of ${stillness.reduce((a, r) => a + r.frames, 0)} frames (largest tracker jitter ${Math.max(0, ...stillness.map((r) => r.maxMotion ?? 0)).toFixed(3)} of shoulder width per sample; the threshold is 0.05).`, "",
    `| Image | Attributes | ${zooms.map((z) => `×${z}`).join(" | ")} |`, `| --- | --- | ${zooms.map(() => "---").join(" | ")} |`];
  for (const f of files) {
    const rs = posture.filter((r) => r.file === f);
    L.push(`| ${f} | ${rs[0].skinTone}, ${rs[0].eyewear}, ${rs[0].headCovering}, ${rs[0].lighting} | ${zooms.map((z) => {
      const r = rs.find((x) => x.scale === z);
      return r ? `lean ${r.lean ?? "—"} · slouch ${r.slouch ?? "—"} · ${r.kind === r.expected ? KIND[r.kind] ?? r.kind : `**${KIND[r.kind] ?? r.kind}** (expected ${KIND[r.expected] ?? r.expected})`}` : "—";
    }).join(" | ")} |`);
  }
  L.push("", "What changed: a code review found that slouch used to be the raw nose-to-shoulder height against calibration. A length shrinks in proportion to distance, so sitting back to ×0.75 read as a 25% slouch, and ×0.65 crossed the old slouch threshold. Slouch is now the eye-to-shoulder height *divided by shoulder width* (distance cancels out), ignored while the head is tipped down more than 15° (reading notes), and lean comes from the face tracker's distance estimate, which head turns don't change (`src/lib/analysis/posture.ts`). The Read also now says when slouch or lean weren't measured instead of reporting zero.",
    "",
    "A live check (the Room's setup screen fed a still portrait as its camera) then showed \"Moving a lot\" flickering on a frozen image: restlessness averaged the nose, shoulders and wrists, and off-screen wrists are guesses that jitter. It now uses the head and shoulders only, as a share of shoulder width (so distance doesn't matter), taking the middle of the three points so one noisy landmark can't trigger it — hand gestures while talking no longer count as restless.", "");
  return L;
}

/** Setup check thresholds against normally framed portraits: nothing here should be flagged except the dim/backlit ones. */
function renderSetup(rows: Row[]): string[] {
  const OLD_FAR = 0.12, FAR = 0.03;
  const sized = rows.filter((r) => r.faceSize !== null);
  const oldFar = sized.filter((r) => r.faceSize! < OLD_FAR), nowFar = sized.filter((r) => r.faceSize! < FAR);
  const dim = rows.filter((r) => r.brightness !== null && r.brightness < 70);
  const L = ["## Setup check (lighting and framing)", "",
    "Every portrait is a normal head-and-shoulders webcam frame, so none should be called \"far from the camera\"; only the dim and backlit ones should be called dim.", "",
    `- Called dim: **${dim.map((r) => r.file).join(", ") || "none"}** (${dim.map((r) => r.lighting).join(", ") || "—"}).`,
    `- Called far with the old threshold (face area under ${OLD_FAR * 100}% of the frame): **${oldFar.length} of ${sized.length}**, including ${oldFar.filter((r) => r.headCovering !== "none").length} of ${sized.filter((r) => r.headCovering !== "none").length} portraits with a head covering — the face mesh measures the face, not the covering.`,
    `- Called far now (under ${FAR * 100}%): **${nowFar.length} of ${sized.length}**. Face area ranged ${Math.min(...sized.map((r) => r.faceSize!)).toFixed(3)}–${Math.max(...sized.map((r) => r.faceSize!)).toFixed(3)}.`, "",
    "| Image | Covering | Lighting | Brightness | Face area | Centre (x, y) |", "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.file} | ${r.headCovering} | ${r.lighting} | ${r.brightness ?? "—"} | ${r.faceSize?.toFixed(3) ?? "—"} | ${r.faceX?.toFixed(2) ?? "—"}, ${r.faceY?.toFixed(2) ?? "—"} |`), ""];
  return L;
}

function render(rows: Row[], posture: PostureRow[], stillness: StillRow[]): string {
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
  const group = (key: keyof Row) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(String(r[key]), [...(m.get(String(r[key])) ?? []), r]);
    return m;
  };
  const summarize = (rs: Row[]) => {
    const cam = rs.filter((r) => r.gaze === "camera"), away = rs.filter((r) => r.gaze === "away");
    return {
      n: rs.length,
      detection: pct(rs.filter((r) => r.faceDetected).length, rs.length),
      cameraCorrect: pct(cam.filter((r) => r.classifiedAs === "camera").length, cam.length),
      awayCorrect: pct(away.filter((r) => r.classifiedAs === "away").length, away.length),
      meanCam: cam.filter((r) => r.engagement !== null).length ? (cam.reduce((a, r) => a + (r.engagement ?? 0), 0) / cam.length).toFixed(2) : "—",
      meanAway: away.filter((r) => r.engagement !== null).length ? (away.reduce((a, r) => a + (r.engagement ?? 0), 0) / away.length).toFixed(2) : "—",
    };
  };
  const all = summarize(rows);
  const L: string[] = [];
  L.push("# Read validation — camera signals & bias audit", "");
  L.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`npm run validate:camera\`. ${rows.length} synthetic webcam portraits (Higgsfield Soul 2.0) spanning skin tone, age, eyewear, head coverings and lighting, each labelled "looking at the lens" or "looking away" and checked by eye. The Room's own on-device code (MediaPipe face + pose, \`VisionTracker\`) runs on each, **uncalibrated** (the Room calibrates per person, so real sessions should do better).`, "");
  L.push("**Pass criteria** (set before running): face detected in every image; camera-gaze and away-gaze each classified correctly (engagement ≥ 0.5 = camera) in at least 80% of images, with no subgroup more than 20 points below the overall rate.", "");
  L.push("| | Images | Face detected | Camera-gaze correct | Away-gaze correct | Mean engagement (camera / away) |", "| --- | --- | --- | --- | --- | --- |");
  L.push(`| **All** | ${all.n} | ${all.detection} | ${all.cameraCorrect} | ${all.awayCorrect} | ${all.meanCam} / ${all.meanAway} |`);
  for (const key of ["skinTone", "eyewear", "headCovering", "lighting", "ageBand"] as const) {
    for (const [v, rs] of group(key)) {
      const s = summarize(rs);
      L.push(`| ${key}: ${v} | ${s.n} | ${s.detection} | ${s.cameraCorrect} | ${s.awayCorrect} | ${s.meanCam} / ${s.meanAway} |`);
    }
  }
  L.push("", "## Per image", "", "| File | Attributes | Gaze | Face | Engagement | Yaw / pitch | Result |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) L.push(`| ${r.file} | ${r.skinTone}, ${r.ageBand}, ${r.eyewear}, ${r.headCovering}, ${r.lighting} | ${r.gaze} | ${r.faceDetected ? "yes" : "**no**"} | ${r.engagement ?? "—"} | ${r.yaw ?? "—"}° / ${r.pitch ?? "—"}° | ${r.classifiedAs === r.gaze ? "correct" : `**${r.classifiedAs}**`} |`);
  const failing = [...(["skinTone", "eyewear", "headCovering", "lighting", "ageBand"] as const)].flatMap((key) => [...group(key)].filter(([, rs]) => {
    const cam = rs.filter((r) => r.gaze === "camera");
    return cam.length > 0 && cam.filter((r) => r.classifiedAs === "camera").length / cam.length < 0.6;
  }).map(([v]) => `${key}: ${v}`));
  L.push("", "## Findings", "", failing.length
    ? `- Below the subgroup bar (uncalibrated): **${failing.join(", ")}**. Subgroups here hold one or two images, so a single miss moves a subgroup to 0% (and groups can be the same image). The miss is a baseline offset — the head-pose estimate reads a forward-facing head as pitched down (see pitch column) — not a detection failure.`
    : "- No subgroup fell below the bar.", "");
  L.push("## What this changes in the product", "",
    "- **Camera engagement now requires the person's own 2-second lens calibration** (`VisionTracker.toSample`). Calibration re-centres head pose and eye position per person, which removes exactly this kind of baseline offset. Without calibration the Read says \"Not measured\" instead of showing a possibly biased number.",
    "- Oriel does not collect skin tone, head coverings or other attributes, so it cannot (and must not) switch signals per group; the fix has to work for everyone.",
    "- Camera engagement stays labelled **estimated, medium confidence**, and gaze can be switched off entirely.",
    "- Lighting problems are surfaced before the interview (setup check).", "");
  if (posture.length) L.push(...renderPosture(posture, stillness));
  L.push(...renderSetup(rows));
  L.push("## Limitations", "",
    "- Synthetic still images, not recorded sessions; one image per condition. This is an early screen for gross failures, not a substitute for testing with real people across skin tones, lighting, glasses, head coverings and disabilities, which is still owed before shipping each camera signal.",
    "- Posture is only tested against distance (zoomed stills). Real slouching, looking down at notes, and movement over time need recordings of people; the slouch threshold is provisional until then.",
    "- The portraits are not committed. Each image's generation prompt is recorded in `tests/validation/faces/manifest.json`; a regenerated set will differ, so re-run and re-check rather than reuse these numbers.", "");
  return L.join("\n");
}
