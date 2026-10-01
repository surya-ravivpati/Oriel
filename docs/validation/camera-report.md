# Read validation — camera signals & bias audit

Generated 2026-10-01 by `npm run validate:camera`. 12 synthetic webcam portraits (Higgsfield Soul 2.0) spanning skin tone, age, eyewear, head coverings and lighting, each labelled "looking at the lens" or "looking away" and checked by eye. The Room's own on-device code (MediaPipe face + pose, `VisionTracker`) runs on each, **uncalibrated** (the Room calibrates per person, so real sessions should do better).

**Pass criteria** (set before running): face detected in every image; camera-gaze and away-gaze each classified correctly (engagement ≥ 0.5 = camera) in at least 80% of images, with no subgroup more than 20 points below the overall rate.

| | Images | Face detected | Camera-gaze correct | Away-gaze correct | Mean engagement (camera / away) |
| --- | --- | --- | --- | --- | --- |
| **All** | 12 | 100% | 86% | 100% | 0.62 / 0.01 |
| skinTone: light | 2 | 100% | 100% | 100% | 0.68 / 0.00 |
| skinTone: dark | 3 | 100% | 100% | 100% | 0.82 / 0.00 |
| skinTone: medium | 5 | 100% | 67% | 100% | 0.47 / 0.01 |
| skinTone: light-medium | 2 | 100% | 100% | 100% | 0.62 / 0.01 |
| eyewear: none | 8 | 100% | 80% | 100% | 0.58 / 0.01 |
| eyewear: glasses | 4 | 100% | 100% | 100% | 0.72 / 0.00 |
| headCovering: none | 8 | 100% | 100% | 100% | 0.70 / 0.00 |
| headCovering: hijab | 2 | 100% | 0% | 100% | 0.22 / 0.00 |
| headCovering: turban | 2 | 100% | 100% | 100% | 0.62 / 0.01 |
| lighting: even | 10 | 100% | 80% | 100% | 0.60 / 0.01 |
| lighting: backlit | 1 | 100% | 100% | — | 0.77 / — |
| lighting: dim | 1 | 100% | 100% | — | 0.56 / — |
| ageBand: 30s | 5 | 100% | 100% | 100% | 0.69 / 0.01 |
| ageBand: 40s | 2 | 100% | 100% | 100% | 0.87 / 0.00 |
| ageBand: 20s | 2 | 100% | 0% | 100% | 0.22 / 0.00 |
| ageBand: 50s | 2 | 100% | 100% | 100% | 0.62 / 0.01 |
| ageBand: 60s | 1 | 100% | 100% | — | 0.56 / — |

## Per image

| File | Attributes | Gaze | Face | Engagement | Yaw / pitch | Result |
| --- | --- | --- | --- | --- | --- | --- |
| face-00.png | light, 30s, none, none, even | camera | yes | 0.682 | 1.9° / 4.8° | correct |
| face-01.png | light, 30s, none, none, even | away | yes | 0.004 | -5.3° / -2.9° | correct |
| face-02.png | dark, 40s, glasses, none, even | camera | yes | 0.874 | -0.6° / -2.5° | correct |
| face-03.png | dark, 40s, glasses, none, even | away | yes | 0 | 5.2° / 12.3° | correct |
| face-04.png | medium, 20s, none, hijab, even | camera | yes | 0.224 | -0.3° / 12.2° | **away** |
| face-05.png | medium, 20s, none, hijab, even | away | yes | 0.003 | 1.1° / 7.6° | correct |
| face-06.png | light-medium, 50s, none, none, even | camera | yes | 0.624 | 0.8° / 6.6° | correct |
| face-07.png | light-medium, 50s, glasses, none, even | away | yes | 0.009 | -19.4° / 9.6° | correct |
| face-08.png | medium, 30s, none, turban, even | camera | yes | 0.616 | -0.9° / 4.1° | correct |
| face-09.png | medium, 30s, none, turban, even | away | yes | 0.009 | 23.5° / 7.9° | correct |
| face-10.png | dark, 30s, none, none, backlit | camera | yes | 0.765 | 3.6° / 3.1° | correct |
| face-11.png | medium, 60s, glasses, none, dim | camera | yes | 0.556 | -2.2° / -1.3° | correct |

## Findings

- Below the subgroup bar (uncalibrated): **headCovering: hijab, ageBand: 20s**. Subgroups here hold one or two images, so a single miss moves a subgroup to 0% (and groups can be the same image). The miss is a baseline offset — the head-pose estimate reads a forward-facing head as pitched down (see pitch column) — not a detection failure.

## What this changes in the product

- **Camera engagement now requires the person's own 2-second lens calibration** (`VisionTracker.toSample`). Calibration re-centres head pose and eye position per person, which removes exactly this kind of baseline offset. Without calibration the Read says "Not measured" instead of showing a possibly biased number.
- Oriel does not collect skin tone, head coverings or other attributes, so it cannot (and must not) switch signals per group; the fix has to work for everyone.
- Camera engagement stays labelled **estimated, medium confidence**, and gaze can be switched off entirely.
- Lighting problems are surfaced before the interview (setup check).

## Posture (calibrated)

Each lens-facing portrait is used as its own 2-second calibration, then run again zoomed out and in (×0.75, ×0.92, ×1, ×1.08, ×1.25) to mimic sitting back and leaning in. Distance alone must never read as a slouch.

**Pass criteria** (set before running): shoulders found at calibration in every image; lean within ±0.06 of the zoom; no slouch at any zoom (slouch estimate below 0.1); ×0.75 read as "sat back", ×1.25 as "leaned in", the rest upright; and no restlessness on 24 repeated frames of each still portrait.

- Shoulders found at calibration: **7/7** portraits.
- Lean error: **0.009** mean absolute, 0.028 worst.
- Slouch flagged by distance alone: **0** of 35 runs (highest slouch estimate 0.068).
- Posture read as expected: **35/35**.
- Still portraits read as restless: **0** of 161 frames (largest tracker jitter 0.026 of shoulder width per sample; the threshold is 0.05).

| Image | Attributes | ×0.75 | ×0.92 | ×1 | ×1.08 | ×1.25 |
| --- | --- | --- | --- | --- | --- | --- |
| face-00.png | light, none, none, even | lean 0.76 · slouch 0 · sat back | lean 0.921 · slouch 0.012 · upright | lean 0.999 · slouch 0.004 · upright | lean 1.074 · slouch 0.023 · upright | lean 1.229 · slouch 0.068 · leaned in |
| face-02.png | dark, glasses, none, even | lean 0.766 · slouch 0 · sat back | lean 0.925 · slouch 0 · upright | lean 1 · slouch 0 · upright | lean 1.071 · slouch 0 · upright | lean 1.223 · slouch 0 · leaned in |
| face-04.png | medium, none, hijab, even | lean 0.762 · slouch 0 · sat back | lean 0.923 · slouch 0 · upright | lean 1 · slouch 0.02 · upright | lean 1.076 · slouch 0 · upright | lean 1.233 · slouch 0.002 · leaned in |
| face-06.png | light-medium, none, none, even | lean 0.768 · slouch 0 · sat back | lean 0.924 · slouch 0 · upright | lean 0.999 · slouch 0 · upright | lean 1.072 · slouch 0 · upright | lean 1.222 · slouch 0.016 · leaned in |
| face-08.png | medium, none, turban, even | lean 0.761 · slouch 0.019 · sat back | lean 0.922 · slouch 0.004 · upright | lean 0.999 · slouch 0.013 · upright | lean 1.074 · slouch 0 · upright | lean 1.232 · slouch 0.031 · leaned in |
| face-10.png | dark, none, none, backlit | lean 0.759 · slouch 0 · sat back | lean 0.918 · slouch 0 · upright | lean 0.998 · slouch 0 · upright | lean 1.071 · slouch 0 · upright | lean 1.229 · slouch 0 · leaned in |
| face-11.png | medium, glasses, none, dim | lean 0.764 · slouch 0 · sat back | lean 0.923 · slouch 0 · upright | lean 1 · slouch 0 · upright | lean 1.072 · slouch 0 · upright | lean 1.225 · slouch 0 · leaned in |

What changed: a code review found that slouch used to be the raw nose-to-shoulder height against calibration. A length shrinks in proportion to distance, so sitting back to ×0.75 read as a 25% slouch, and ×0.65 crossed the old slouch threshold. Slouch is now the eye-to-shoulder height *divided by shoulder width* (distance cancels out), ignored while the head is tipped down more than 15° (reading notes), and lean comes from the face tracker's distance estimate, which head turns don't change (`src/lib/analysis/posture.ts`). The Read also now says when slouch or lean weren't measured instead of reporting zero.

A live check (the Room's setup screen fed a still portrait as its camera) then showed "Moving a lot" flickering on a frozen image: restlessness averaged the nose, shoulders and wrists, and off-screen wrists are guesses that jitter. It now uses the head and shoulders only, as a share of shoulder width (so distance doesn't matter), taking the middle of the three points so one noisy landmark can't trigger it — hand gestures while talking no longer count as restless.

## Setup check (lighting and framing)

Every portrait is a normal head-and-shoulders webcam frame, so none should be called "far from the camera"; only the dim and backlit ones should be called dim.

- Called dim: **face-10.png, face-11.png** (backlit, dim).
- Called far with the old threshold (face area under 12% of the frame): **8 of 12**, including 3 of 4 portraits with a head covering — the face mesh measures the face, not the covering.
- Called far now (under 3%): **0 of 12**. Face area ranged 0.047–0.181.

| Image | Covering | Lighting | Brightness | Face area | Centre (x, y) |
| --- | --- | --- | --- | --- | --- |
| face-00.png | none | even | 108 | 0.078 | 0.51, 0.43 |
| face-01.png | none | even | 108 | 0.091 | 0.50, 0.44 |
| face-02.png | none | even | 139 | 0.154 | 0.51, 0.47 |
| face-03.png | none | even | 139 | 0.158 | 0.41, 0.47 |
| face-04.png | hijab | even | 137 | 0.054 | 0.51, 0.42 |
| face-05.png | hijab | even | 137 | 0.047 | 0.53, 0.36 |
| face-06.png | none | even | 140 | 0.181 | 0.50, 0.49 |
| face-07.png | none | even | 140 | 0.061 | 0.53, 0.41 |
| face-08.png | turban | even | 111 | 0.062 | 0.49, 0.45 |
| face-09.png | turban | even | 111 | 0.124 | 0.50, 0.42 |
| face-10.png | none | backlit | 59 | 0.073 | 0.49, 0.41 |
| face-11.png | none | dim | 59 | 0.110 | 0.53, 0.35 |

## Limitations

- Synthetic still images, not recorded sessions; one image per condition. This is an early screen for gross failures, not a substitute for testing with real people across skin tones, lighting, glasses, head coverings and disabilities, which is still owed before shipping each camera signal.
- Posture is only tested against distance (zoomed stills). Real slouching, looking down at notes, and movement over time need recordings of people; the slouch threshold is provisional until then.
- The portraits are not committed. Each image's generation prompt is recorded in `tests/validation/faces/manifest.json`; a regenerated set will differ, so re-run and re-check rather than reuse these numbers.
