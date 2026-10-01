# Oriel — privacy counsel review packet

Prepared 2026-09-30 for the review the business plan requires *before anyone sits in front of a camera*. This packet describes what the product actually does today (with file references), and lists the questions we need counsel to answer. It is not legal advice.

## 1. Product posture

- Practice-only interview simulator for individuals. Not an employment screening tool; no employer-facing individual data (campus/employer tiers see aggregates only). No live-interview "copilot".
- The interviewer is disclosed as an AI at the start of every session (spoken in the opening line and shown on the consent screen).

## 2. Data inventory

| Category | Where it lives | Notes |
| --- | --- | --- |
| Account (email, scrypt password hash, profile) | `users`, `profiles` | |
| Resume / job description text + parsed structure | `resumes`, `job_descriptions` | Parser output is filtered to text that literally appears in the source |
| Transcript, questions, answers, claims ledger | `transcript_segments`, `questions`, `answers`, `claims` | |
| Session recording (video + both voices) | `data/media/<user>/<media>/seg-*.bin` | AES-256-GCM, per-user HKDF keys, signed short-lived URLs + owner session required |
| Audio-derived timeline (10 Hz loudness, voiced flag, pitch) | `signal_timelines(kind=audio)` | Not a voiceprint; deleted with raw recording |
| Camera-derived timeline (~4 Hz: face present, engagement estimate, yaw/pitch, lean, slouch, sway, motion, brightness) | `signal_timelines(kind=vision)` | Computed on device from MediaPipe landmarks; landmarks never transmitted (API schema has no field for them). Deleted with raw recording, or immediately on consent withdrawal |
| Aggregate Read metrics, Playback text | `metrics`, `playback_clips`, `progress_snapshots` | |
| Consent records (kind, granted, version, SHA-256 of wording, e-signature, user agent) | `consent_records` | Kept after account deletion without interview content |
| Audit log | `audit_logs` | No interview content |

## 3. Data flows to third parties

| Recipient | Data | Purpose |
| --- | --- | --- |
| Google Gemini API | Candidate answer text, recent conversation turns; answer audio clips for transcription; resume/JD text | Interviewer phrasing, TTS, transcription, parsing, coaching |
| Browser speech service (Chrome Web Speech) | Microphone audio (browser → vendor) | Live captions; disclosed in the consent copy |
| Google model CDN | None (model download) | MediaPipe models |

## 4. Consent flow (as built)

1. Sign-up: terms + privacy/biometric policy checkbox (`consent_records.kind=terms`).
2. Every session, before any device turns on (`src/features/room/ConsentDialog.tsx`): AI disclosure; separate toggles for microphone, camera, recording, camera-based signals.
3. Camera-based signals require an **electronic signature** (typed full name) on the release text; the server rejects a grant without it (`src/app/api/sessions/[id]/consent/route.ts`). Each record stores the consent version and a SHA-256 hash of the exact wording (`src/lib/privacy/consent-hash.ts`).
4. Settings changes (camera signals, gaze, posture, recording) are logged as consent records; withdrawing camera signals deletes stored camera-derived timelines (`src/app/api/privacy/settings/route.ts`).

## 5. Retention & destruction (published at `/privacy#retention`)

- Raw recording: user choice 1/7/30/90 days (default 30); shortening applies retroactively; hourly sweeper deletes (`src/server/privacy/retention.ts`).
- Frame-level signal timelines: deleted with the raw recording.
- Accounts: deleted after 3 years without sign-in (sweeper).
- Session delete / account delete: immediate (`src/server/privacy/deletion.ts`). JSON export available.

## 6. Questions for counsel

1. **Are the derived camera signals "biometric identifiers/information"?** We never store face geometry; we store per-frame head-pose angles, an engagement estimate and upper-body position ratios. Is the on-device computation itself a "collection" under BIPA (e.g., *scan of face geometry*) even when nothing identifying leaves the device? Is the current written-release flow sufficient either way?
2. **Voice:** we transmit answer audio to a processor for transcription and compute pitch/loudness timelines. Does either create a "voiceprint" risk under BIPA/CUBI? Do we need a processor-specific disclosure or DPA terms (zero retention) with Google?
3. **Electronic signature adequacy:** typed name + recorded wording hash + timestamp + user agent — enough for a "written release" (740 ILCS 14/15(b)(3)) including the 2024 amendment? Should consent be refreshed per session (current) or once per account?
4. **Public retention schedule:** does `/privacy#retention` satisfy 14/15(a)? Is the 3-year inactivity purge the right outer bound given our shorter defaults?
5. **Other states:** Texas CUBI, Washington (H.B. 1493 and My Health My Data — is interview-stress feedback "health data"?), Colorado biometric amendments, and New York City/Illinois AI-in-employment laws — confirm they do not reach a candidate-side practice tool, and what separation we must keep from any hiring product.
6. **Minors:** campus pilots may include under-18 students. Age gate and parental consent requirements?
7. **AI disclosure:** is the spoken + written disclosure sufficient under emerging chatbot/AI-disclosure laws (e.g., California SB 1001, Utah AI Policy Act, EU AI Act Art. 50 for EU users)?
8. **Campus/employer tier:** confirm the consent language needed before any individual result could be shared, and that aggregate reporting thresholds are adequate to prevent re-identification.
9. **Cross-border:** EU/UK users — lawful basis, SCCs for US processing, special-category data analysis for camera signals.
10. **Incident response:** notification obligations and timelines for a breach of encrypted recordings.

## 7. Known gaps we will close before launch (engineering)

- Processor agreements (DPA, zero-data-retention settings) with the AI provider.
- Age gate at sign-up.
- Region-aware consent copy (EU/UK).
- Fairness testing on recorded (not synthetic) sessions — see `docs/validation/`.
