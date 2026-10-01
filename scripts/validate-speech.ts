/**
 * Speech-metric validation (Read accuracy + accent bias check).
 *
 *   npm run validate:speech        (needs GEMINI_API_KEY; ~4 min with a 10 RPM key)
 *
 * Builds labelled answer clips with known ground truth — a known silence before the
 * first word (recovery), a known mid-answer pause, a known script (words, fillers,
 * hedges) — across eight English accents directed to the TTS model, then runs them
 * through the SAME code the product uses: 10 Hz frame analysis (audio-frames.ts),
 * server transcription (Gemini), and the Read (read.ts / text.ts).
 *
 * Limitations (stated in the report): voices are synthetic; accents are as directed to
 * the TTS model and not verified by native listeners; this complements, and does not
 * replace, validation against human-coded recordings of real candidates.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const OUT_DIR = "tests/validation/speech";
const REPORT_DIR = "docs/validation";
const SR = 24000;

const ACCENTS = [
  { id: "us", label: "US English", voice: "Puck", direction: "" },
  { id: "uk", label: "British English", voice: "Charon", direction: "British English (London)" },
  { id: "in", label: "Indian English", voice: "Kore", direction: "Indian English" },
  { id: "ng", label: "Nigerian English", voice: "Fenrir", direction: "Nigerian English" },
  { id: "es", label: "Spanish-accented English", voice: "Aoede", direction: "English spoken with a Spanish (Spain) accent" },
  { id: "cn", label: "Mandarin-accented English", voice: "Leda", direction: "English spoken with a Mandarin Chinese accent" },
  { id: "au", label: "Australian English", voice: "Orus", direction: "Australian English" },
  { id: "south", label: "Southern US English", voice: "Achird", direction: "Southern United States English" },
];

const SCRIPTS: Record<string, [string, string]> = {
  fluent: [
    "In my last role I led the migration of our billing system to a new platform.",
    "We finished two weeks early, and invoice errors dropped by about thirty percent.",
  ],
  disfluent: [
    "Um, so in my last role I, uh, kind of led the migration of our billing system.",
    "And, like, we finished early, I think, and um, invoice errors dropped, you know, quite a bit.",
  ],
};

const LEADING_MS = [900, 1600, 2600, 4100];
const PAUSE_MS = [1300, 2400];

type ClipTruth = { accent: string; label: string; script: string; leadingMs: number; pauseMs: number; text: string };

function wav(pcm: Int16Array, sr = SR): Buffer {
  const body = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + body.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(body.length, 40);
  return Buffer.concat([h, body]);
}

function toFloat(pcm: Int16Array) {
  const f = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
  return f;
}

/** Sample-level onset/offset (independent of the product's frame VAD). */
function activeSpan(pcm: Int16Array, thr = 0.02 * 32768): [number, number] {
  let a = 0, b = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a]) < thr) a++;
  while (b > a && Math.abs(pcm[b]) < thr) b--;
  return [a, b];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= 6 || !/429|quota|timeout|5\d\d/.test(msg)) throw err;
      const wait = 8000 + attempt * 6000;
      console.log(`  ${label}: ${msg.slice(0, 80)} — retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

async function main() {
  const { GeminiSpeechToText } = await import("../src/lib/ai/providers/gemini");
  const { analyzeClip } = await import("../src/lib/analysis/audio-frames");
  const { computeRead, findPauses } = await import("../src/lib/analysis/read");
  const { countFillers, countHedges, words } = await import("../src/lib/analysis/text");
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required");
  const stt = new GeminiSpeechToText(key);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // Fixture synthesis (not product code): the non-lite TTS model follows accent direction
  // without reading it aloud; the lite model does not (verified with a probe).
  const TTS_MODEL = "gemini-3.8-flash-tts";
  const synth = async (voice: string, direction: string, text: string): Promise<Int16Array> => {
    const id = createHash("sha256").update([TTS_MODEL, voice, direction, text].join("|")).digest("hex").slice(0, 24);
    const cache = path.join(OUT_DIR, `seg-${id}.pcm`);
    if (fs.existsSync(cache)) return new Int16Array(new Uint8Array(fs.readFileSync(cache)).buffer);
    const prompt = direction ? `# AUDIO PROFILE: Job candidate\n### DIRECTOR'S NOTES\nAccent: ${direction}.\nPacing: natural conversational.\n#### TRANSCRIPT\n${text}` : text;
    const buf = await withRetry(async () => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
      });
      const j = await res.json() as { error?: { message: string }; candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
      if (j.error) throw new Error(`${res.status} ${j.error.message}`);
      let pcm = Buffer.from(j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? "", "base64");
      if (pcm.subarray(0, 4).toString() === "RIFF") pcm = pcm.subarray(44);
      return pcm;
    }, "tts");
    fs.writeFileSync(cache, buf);
    await sleep(6500); // stay inside a 10 RPM quota
    return new Int16Array(new Uint8Array(buf).buffer);
  };
  const transcriptCachePath = path.join(OUT_DIR, "transcripts.json");
  const transcriptCache: Record<string, string> = fs.existsSync(transcriptCachePath) ? JSON.parse(fs.readFileSync(transcriptCachePath, "utf8")) : {};

  const results: Record<string, unknown>[] = [];
  let i = 0;
  for (const accent of ACCENTS) {
    for (const [scriptId, [s1, s2]] of Object.entries(SCRIPTS)) {
      const leadingMs = LEADING_MS[i % LEADING_MS.length];
      const pauseMs = PAUSE_MS[i % PAUSE_MS.length];
      i++;
      console.log(`clip ${i}/${ACCENTS.length * 2}: ${accent.label} · ${scriptId}`);
      const a = await synth(accent.voice, accent.direction, s1);
      const b = await synth(accent.voice, accent.direction, s2);
      const [a0, a1] = activeSpan(a);
      const [b0, b1] = activeSpan(b);
      const lead = new Int16Array(Math.round((leadingMs / 1000) * SR));
      const gap = new Int16Array(Math.round((pauseMs / 1000) * SR));
      const tail = new Int16Array(Math.round(1.2 * SR));
      const clip = new Int16Array(lead.length + a.length + gap.length + b.length + tail.length);
      clip.set(lead, 0); clip.set(a, lead.length); clip.set(gap, lead.length + a.length); clip.set(b, lead.length + a.length + gap.length);
      const file = path.join(OUT_DIR, `${accent.id}-${scriptId}.wav`);
      const wavBuf = wav(clip);
      fs.writeFileSync(file, wavBuf);

      // Ground truth.
      const text = `${s1} ${s2}`;
      const truthFirstWordMs = ((lead.length + a0) / SR) * 1000;
      const truthPauseMs = ((a.length - a1 + gap.length + b0) / SR) * 1000;
      const truthSpeechSec = (a1 - a0 + b1 - b0) / SR;
      const truthWpm = (words(text).length / truthSpeechSec) * 60;
      const truthFillers = countFillers(text).total;
      const truthHedges = countHedges(text).total;

      // Pipeline: frame analysis → transcription → Read.
      const { samples } = analyzeClip(toFloat(clip), SR);
      const firstVoiced = samples.find((x) => x.voiced);
      const lastVoiced = [...samples].reverse().find((x) => x.voiced);
      const detectedFirstWordMs = firstVoiced ? firstVoiced.t - 200 : null;
      const audioId = createHash("sha256").update(wavBuf).digest("hex").slice(0, 24);
      let transcript = transcriptCache[audioId];
      if (transcript === undefined) {
        transcript = (await withRetry(() => stt.transcribe({ audio: wavBuf, mimeType: "audio/wav", timeoutMs: 40000 }), "stt")).text;
        transcriptCache[audioId] = transcript;
        fs.writeFileSync(transcriptCachePath, JSON.stringify(transcriptCache, null, 1));
        await sleep(6500);
      }
      if (/director|audio profile|transcript|accent/i.test(transcript)) console.log(`  WARNING: direction may have been read aloud: ${transcript.slice(0, 80)}`);
      const start = detectedFirstWordMs ?? 0;
      const end = lastVoiced ? lastVoiced.t : (clip.length / SR) * 1000;
      const { metrics } = computeRead([{
        id: "a", questionId: "q", questionText: "Tell me about a project.", questionKind: "primary", questionDifficulty: 2,
        questionEndMs: 0, text: transcript, startMs: start, endMs: end, firstWordLatencyMs: detectedFirstWordMs, interrupted: false, inputMode: "voice",
      }], samples, [], null, { cameraMetrics: false, gaze: false, posture: false });
      const pace = metrics.find((m) => m.key === "pace_wpm")?.value ?? null;
      const pauses = findPauses(samples, start, end);
      const longest = pauses.reduce((m, p) => Math.max(m, p.durationMs), 0);
      const detFillers = countFillers(transcript).total;
      const detHedges = countHedges(transcript).total;

      results.push({
        accent: accent.id, accentLabel: accent.label, script: scriptId, file,
        truth: { firstWordMs: Math.round(truthFirstWordMs), pauseMs: Math.round(truthPauseMs), wpm: Math.round(truthWpm), fillers: truthFillers, hedges: truthHedges, words: words(text).length },
        measured: { firstWordMs: detectedFirstWordMs, longestPauseMs: longest, wpm: pace, fillers: detFillers, hedges: detHedges, words: words(transcript).length, transcript },
        error: {
          recoveryMs: detectedFirstWordMs === null ? null : Math.round(detectedFirstWordMs - truthFirstWordMs),
          pauseMs: Math.round(longest - truthPauseMs),
          pacePct: pace === null ? null : Math.round(((pace - truthWpm) / truthWpm) * 1000) / 10,
          fillers: detFillers - truthFillers,
          hedges: detHedges - truthHedges,
        },
      });
      console.log(`  truth wpm ${Math.round(truthWpm)} / measured ${pace}; fillers ${truthFillers}/${detFillers}; first word ${Math.round(truthFirstWordMs)}/${detectedFirstWordMs} ms`);
    }
  }

  fs.writeFileSync(path.join(REPORT_DIR, "speech-results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, "speech-report.md"), renderReport(results));
  console.log(`\nWrote ${REPORT_DIR}/speech-report.md`);
}

type R = { accent: string; accentLabel: string; script: string; truth: Record<string, number>; measured: Record<string, number | string | null>; error: Record<string, number | null> };

export function renderReport(rows: Record<string, unknown>[]): string {
  const r = rows as unknown as R[];
  const abs = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null).map(Math.abs);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const pass = (x: R) => ({
    pace: x.error.pacePct !== null && Math.abs(x.error.pacePct) <= 12,
    fillers: x.error.fillers !== null && Math.abs(x.error.fillers) <= 1,
    recovery: x.error.recoveryMs !== null && Math.abs(x.error.recoveryMs) <= 250,
    pause: x.error.pauseMs !== null && Math.abs(x.error.pauseMs) <= 350,
  });
  const lines: string[] = [];
  lines.push("# Read validation — speech metrics", "");
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`npm run validate:speech\`. ${r.length} labelled clips (8 accents × fluent/disfluent scripts).`, "");
  lines.push("Ground truth comes from construction: a known silence before the first word, a known inserted pause, and a known script. Measurements come from the production code paths (10 Hz frame analysis, Gemini transcription, the Read).", "");
  lines.push("**Pass criteria** (set before running): pace within ±12%, filler count within ±1, recovery (time to first word) within ±250 ms, inserted pause measured within ±350 ms.", "");
  const agg = [
    ["Pace (WPM) — mean abs. error", `${mean(abs(r.map((x) => x.error.pacePct))).toFixed(1)}%`, `${r.filter((x) => pass(x).pace).length}/${r.length} within ±12%`],
    ["Fillers — mean abs. count error", mean(abs(r.map((x) => x.error.fillers))).toFixed(2), `${r.filter((x) => pass(x).fillers).length}/${r.length} within ±1`],
    ["Recovery — mean abs. error", `${Math.round(mean(abs(r.map((x) => x.error.recoveryMs))))} ms`, `${r.filter((x) => pass(x).recovery).length}/${r.length} within ±250 ms`],
    ["Inserted pause — mean abs. error", `${Math.round(mean(abs(r.map((x) => x.error.pauseMs))))} ms`, `${r.filter((x) => pass(x).pause).length}/${r.length} within ±350 ms`],
  ];
  lines.push("| Measure | Error | Agreement |", "| --- | --- | --- |", ...agg.map((a) => `| ${a.join(" | ")} |`), "");
  lines.push("## By accent", "", "| Accent | Script | Pace truth → measured | Fillers truth → measured | First word truth → measured | Pause truth → measured |", "| --- | --- | --- | --- | --- | --- |");
  for (const x of r) {
    lines.push(`| ${x.accentLabel} | ${x.script} | ${x.truth.wpm} → ${x.measured.wpm ?? "—"} wpm | ${x.truth.fillers} → ${x.measured.fillers} | ${x.truth.firstWordMs} → ${x.measured.firstWordMs ?? "—"} ms | ${x.truth.pauseMs} → ${x.measured.longestPauseMs} ms |`);
  }
  lines.push("", "## Accent parity", "");
  const byAccent = new Map<string, R[]>();
  for (const x of r) byAccent.set(x.accentLabel, [...(byAccent.get(x.accentLabel) ?? []), x]);
  lines.push("| Accent | Pace abs. error | Filler abs. error | Recovery abs. error |", "| --- | --- | --- | --- |");
  for (const [label, xs] of byAccent) {
    lines.push(`| ${label} | ${mean(abs(xs.map((x) => x.error.pacePct))).toFixed(1)}% | ${mean(abs(xs.map((x) => x.error.fillers))).toFixed(1)} | ${Math.round(mean(abs(xs.map((x) => x.error.recoveryMs))))} ms |`);
  }
  const fillerMisses = r.filter((x) => x.error.fillers !== null && x.error.fillers < -1);
  lines.push("", "## Findings", "",
    "- **Pace** read ~20% slow in the first run because speaking time was estimated as voiced time × 1.25; it is now the answer span minus pauses ≥ 0.7 s.",
    "- **Pauses** were measured ~170 ms short — the voice detector's on/off hysteresis. `findPauses` now corrects for the mechanism.",
    fillerMisses.length
      ? `- **Fillers**: transcription dropped short mid-sentence "uh"/"um" for ${fillerMisses.map((x) => x.accentLabel).join(", ")} (${fillerMisses.map((x) => `${x.truth.fillers}→${x.measured.fillers}`).join(", ")}). The Read now presents filler counts as a minimum; because progress compares each person with their own earlier sessions, a consistent undercount does not distort improvement. An acoustic filled-pause detector would close this gap.`
      : "- **Fillers**: no accent fell outside ±1.",
    "- Pitch is no longer computed on quiet tail frames the detector still marks as voiced (spurious harmonics inflated vocal variety).", "");
  lines.push("## Limitations", "",
    "- Voices are synthetic (Gemini TTS). Accents are as directed to the model and were not verified by native listeners.",
    "- Synthetic speech is cleaner than a laptop microphone in a real room; real-world error will be higher.",
    "- This complements — it does not replace — the plan's validation against human-coded video of real sessions (30 sessions), which is still owed.",
    "- Accent is never scored by Oriel. This check exists to make sure measurements do not drift by accent.", "");
  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
