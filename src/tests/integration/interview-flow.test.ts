import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

// Isolated media directory for this test file.
process.env.MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "oriel-media-"));

import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { createInterview, runOpening, runTurn, type RoomEvent } from "@/server/interview/service";
import { enqueueAnalysis, PIPELINE_STEPS, runJob } from "@/server/processing/pipeline";
import { lessonsFor, recordLessonPractice } from "@/server/lessons";
import { deleteSession } from "@/server/privacy/deletion";
import { appendSegment, createMedia, readRange } from "@/lib/privacy/media-store";
import { HttpError } from "@/lib/api/errors";
import { saveStyle, savedStyles } from "@/server/avatar-styles";

async function drain(gen: AsyncGenerator<RoomEvent>) {
  const out: RoomEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

function makeUser(plan: "free" | "pro" | "sprint" = "pro") {
  const db = getDb();
  const id = newId("usr");
  db.insert(schema.users).values({ id, email: `${id}@oriel.test`, passwordHash: "x", onboardedAt: new Date() }).run();
  db.insert(schema.profiles).values({ userId: id, name: "Jordan Lee", targetRole: "Product Manager", domain: "product" }).run();
  db.insert(schema.subscriptions).values({ id: newId("sub"), userId: id, plan, periodStart: new Date() }).run();
  db.insert(schema.ladderProgress).values({ userId: id, level: 1, unlockedAt: new Date() }).run();
  return id;
}

const base = { role: "Product Manager", domain: "product", level: "hiring_manager", type: "behavioral" as const, pressure: 4, persona: "skeptic" as const, mode: "single" as const, panelSize: 3, ladderLevel: null, targetMinutes: 15, cameraMetrics: true };

const ANSWERS = [
  "I'm a product manager with seven years in fintech. I managed a team of 12 across design and engineering at Contoso, and I led the relaunch of our onboarding flow.",
  "We worked on a lot of things and helped with various stuff. It went pretty well overall and the team did a lot.",
  "In 2024 activation was flat at 31 percent. I ran twelve customer interviews, I proposed cutting two onboarding steps, and I convinced engineering to ship it in six weeks. As a result activation rose to 44 percent, which meant sales could stop discounting.",
  "Um, I think, uh, maybe it was, like, kind of a big deal? I guess we did stuff and it sort of worked out, you know.",
  "The hardest trade-off was dropping the enterprise dashboard. I decided to cut it because only 3 of our 40 enterprise customers used it weekly, and I presented the data to our VP.",
  "What does success look like in the first ninety days?",
];

describe("interview flow (mock providers)", () => {
  let userId: string;
  let sessionId: string;
  const texts: string[] = [];

  beforeAll(() => {
    userId = makeUser("pro");
  });

  it("creates a session with a seated interviewer and a question plan", () => {
    ({ sessionId } = createInterview(userId, base));
    const db = getDb();
    const s = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get()!;
    expect(s.status).toBe("created");
    const state = s.controllerState as { plan: unknown[] };
    expect(state.plan.length).toBeGreaterThanOrEqual(3);
    expect(db.select().from(schema.interviewers).where(eq(schema.interviewers.sessionId, sessionId)).all()).toHaveLength(1);
  });

  it("opens with an AI disclosure and asks the first question", async () => {
    const events = await drain(runOpening(sessionId, userId));
    const text = events.find((e) => e.type === "text") as Extract<RoomEvent, { type: "text" }>;
    expect(text.text).toMatch(/AI interviewer/i);
    expect(events.some((e) => e.type === "tts_fallback")).toBe(true); // no TTS key in tests → browser voice
    expect(events.at(-1)?.type).toBe("done");
  });

  it("runs turns: follows up on vague answers, remembers claims, keeps going", async () => {
    let t = 5000;
    for (const a of ANSWERS) {
      const events = await drain(runTurn(sessionId, userId, {
        answerText: a, startMs: t, endMs: t + 30000, firstWordLatencyMs: a.startsWith("Um") ? 5200 : 900,
        interrupted: false, inputMode: "voice", prevQuestion: null,
      }));
      const d = events.find((e) => e.type === "decision") as Extract<RoomEvent, { type: "decision" }>;
      const text = events.find((e) => e.type === "text") as Extract<RoomEvent, { type: "text" }>;
      expect(d).toBeDefined();
      texts.push(`${d.intent}: ${text.text}`);
      t += 45000;
      const done = events.at(-1) as Extract<RoomEvent, { type: "done" }>;
      if (done.complete) break;
    }
    const db = getDb();
    const answers = db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).all();
    expect(answers.length).toBeGreaterThanOrEqual(5);
    // The vague answer must not simply be accepted.
    expect(texts[1]).toMatch(/^(ask_specifics|ask_personal_role|ask_result|clarify_short|challenge_claim|probe_number|redirect_after_interrupt|cross_question)/);
    const claims = db.select().from(schema.claims).where(eq(schema.claims.sessionId, sessionId)).all();
    expect(claims.some((c) => /team of 12/i.test(c.text))).toBe(true);
    // Everything the interviewer referenced as a claim is verbatim from an answer.
    const all = answers.map((a) => a.text.toLowerCase()).join(" ");
    for (const c of claims) expect(all).toContain(c.normalized ?? c.text.toLowerCase());
  });

  it("never runs two turns at once for the same session", async () => {
    const a = runTurn(sessionId, userId, { answerText: "x", startMs: 1, endMs: 2, firstWordLatencyMs: null, interrupted: false, inputMode: "text", prevQuestion: null });
    const b = runTurn(sessionId, userId, { answerText: "y", startMs: 1, endMs: 2, firstWordLatencyMs: null, interrupted: false, inputMode: "text", prevQuestion: null });
    const first = a.next();
    await expect(b.next()).rejects.toBeInstanceOf(HttpError);
    await first.catch(() => null);
    await drain(a).catch(() => null);
  });

  it("completes: the pipeline produces a Read, Playback clips, coaching and a progress snapshot", async () => {
    const db = getDb();
    // Audio timeline: voiced speech with a long pause in the hedgy answer.
    const samples = [] as { t: number; rms: number; voiced: boolean; pitch: number | null }[];
    for (let t = 0; t < 300000; t += 100) {
      const inPause = t % 45000 > 30000 || (t > 140000 && t < 145000);
      samples.push({ t, rms: inPause ? 0.002 : 0.06, voiced: !inPause, pitch: inPause ? null : 130 + 25 * Math.sin(t / 900) });
    }
    db.insert(schema.signalTimelines).values({ id: newId("sig"), sessionId, kind: "audio", startMs: 0, samples }).run();
    const vision = Array.from({ length: 400 }, (_, i) => ({ t: i * 700, face: true, engaged: i % 4 === 0 ? 0.2 : 0.85, yaw: 2, pitch: 1, lean: 1, slouch: i > 300 ? 0.5 : 0.1, sway: 0.5, motion: 0.004, brightness: 130 }));
    db.insert(schema.signalTimelines).values({ id: newId("sig"), sessionId, kind: "vision", startMs: 0, samples: vision }).run();
    db.update(schema.interviewSessions).set({ status: "ended", endedAt: new Date(), startedAt: new Date(Date.now() - 300000) }).where(eq(schema.interviewSessions.id, sessionId)).run();

    const jobId = enqueueAnalysis(sessionId);
    await runJob(jobId);
    const s = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get()!;
    expect(s.analysisError).toBeNull();
    expect(s.analysisStatus).toBe("complete");
    const metrics = db.select().from(schema.metrics).where(eq(schema.metrics.sessionId, sessionId)).all();
    const keys = metrics.map((m) => m.key);
    for (const k of ["pace_wpm", "filler_per_min", "pauses", "structure_score", "specificity", "recovery_ms", "camera_engagement", "movement"]) expect(keys).toContain(k);
    expect(metrics.find((m) => m.key === "filler_per_min")!.confidence).toBe("high");
    expect(metrics.find((m) => m.key === "camera_engagement")!.confidence).toBe("medium");
    const clips = db.select().from(schema.playbackClips).where(eq(schema.playbackClips.sessionId, sessionId)).all();
    expect(clips.length).toBeGreaterThanOrEqual(3);
    expect(clips.length).toBeLessThanOrEqual(5);
    for (const c of clips) {
      expect(c.suggestion).toMatch(/^Try:/);
      expect(c.observed.length).toBeGreaterThan(10);
    }
    expect(s.summary?.source).toBe("heuristic");
    const snap = db.select().from(schema.progressSnapshots).where(eq(schema.progressSnapshots.sessionId, sessionId)).get();
    expect(snap?.metrics.filler_per_min).toBeGreaterThan(0);
    const job = db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, jobId)).get()!;
    expect(Object.keys(job.stepTimings ?? {})).toHaveLength(PIPELINE_STEPS.length);

    // Lessons: planned from this interview, quoting only what was actually said.
    const lessons = lessonsFor(userId);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.filter((l) => l.status === "active").length).toBeLessThanOrEqual(5);
    const answerText = db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).all().map((a) => a.serverText ?? a.text).join(" \n ");
    for (const l of lessons) {
      expect(l.sourceSessionId).toBe(sessionId);
      for (const q of l.evidence.quotes) expect(answerText).toContain(q.text.replace(/…$/, ""));
      expect(l.content.source).toBe("heuristic"); // mock model → template text
    }
    // A lesson exists only where the Read's own measure was off target.
    for (const l of lessons) {
      const m = metrics.find((x) => x.key === l.metricKey);
      if (m && m.value !== null && m.targetLow !== null && m.targetHigh !== null) expect(m.value < m.targetLow || m.value > m.targetHigh).toBe(true);
    }
    const pace = metrics.find((m) => m.key === "pace_wpm")!;
    expect(lessons.some((l) => l.lessonKey === "pace")).toBe(pace.value! < 120 || pace.value! > 160);

    // Practice counts toward the open lesson that uses that drill.
    const open = lessons.find((l) => l.status === "active")!;
    const drillId = { pace: "steady_pace", fillers: "replace_filler", hedging: "own_it", structure: "star_structure", specificity: "quantify_results", recovery: "hard_recovery", concision: "point_first", opener: "opener_30s", vocal_variety: "emphasis", eye_contact: "hold_the_lens", posture: "steady_posture" }[open.lessonKey]!;
    expect(recordLessonPractice(userId, drillId, true)).toMatchObject({ key: open.lessonKey, passes: 1, needed: 2 });
    expect(recordLessonPractice(userId, drillId, false)).toMatchObject({ passes: 1 });
  });

  it("keeps the interview when analysis fails, and can retry", async () => {
    const db = getDb();
    const before = db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).all().length;
    // Malformed signal rows are tolerated, not fatal…
    db.insert(schema.signalTimelines).values({ id: newId("sig"), sessionId, kind: "audio", startMs: 0, samples: "not-an-array" as unknown as unknown[] }).run();
    // …and a hard failure mid-pipeline leaves the interview intact and retryable.
    process.env.ORIEL_PIPELINE_FAIL_STEP = "coaching_generation";
    const jobId = enqueueAnalysis(sessionId);
    await runJob(jobId);
    delete process.env.ORIEL_PIPELINE_FAIL_STEP;
    let s = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get()!;
    expect(s.analysisStatus).toBe("failed");
    expect(db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).all().length).toBe(before);
    expect(s.analysisError).toMatch(/injected failure/);
    await runJob(enqueueAnalysis(sessionId));
    s = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get()!;
    expect(s.analysisStatus).toBe("complete");
  });

  it("deletes a session with its recording and every related row", () => {
    const db = getDb();
    const media = createMedia(userId, "med_test1", "video/webm");
    appendSegment(userId, "med_test1", 0, Buffer.from("hello-recording"));
    db.insert(schema.mediaObjects).values({ id: "med_test1", userId, sessionId, kind: "session_recording", mimeType: "video/webm", storageKey: media, bytes: 15, status: "complete" }).run();
    expect(readRange(userId, "med_test1", 0, 4).toString()).toBe("hello");
    expect(deleteSession(userId, sessionId)).toBe(true);
    expect(db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get()).toBeUndefined();
    expect(db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).all()).toHaveLength(0);
    expect(db.select().from(schema.playbackClips).where(eq(schema.playbackClips.sessionId, sessionId)).all()).toHaveLength(0);
    expect(fs.existsSync(path.join(process.env.MEDIA_DIR!, userId, "med_test1"))).toBe(false);
    // Lessons quote the interview, so they go with it.
    expect(lessonsFor(userId).filter((l) => l.sourceSessionId === sessionId)).toHaveLength(0);
  });
});

describe("entitlements are enforced at session creation", () => {
  it("allows one free session per week and blocks panels on free", () => {
    const uid = makeUser("free");
    expect(() => createInterview(uid, { ...base, mode: "panel" })).toThrow(/Panel/);
    createInterview(uid, base);
    expect(() => createInterview(uid, base)).toThrow(/per week/);
  });
  it("seats a full panel for Sprint and assigns roles", () => {
    const uid = makeUser("sprint");
    const { sessionId } = createInterview(uid, { ...base, mode: "panel", panelSize: 3 });
    const seats = getDb().select().from(schema.interviewers).where(eq(schema.interviewers.sessionId, sessionId)).all();
    expect(seats.map((s) => s.panelRole).sort()).toEqual(["hiring_manager", "peer", "skeptic"]);
  });
  it("keeps locked Ladder rungs locked", () => {
    const uid = makeUser("pro");
    expect(() => createInterview(uid, { ...base, ladderLevel: 4 })).toThrow(/locked/);
  });
});

describe("abandoned sessions", () => {
  it("finalises idle live sessions and queues their Read; empty ones are marked abandoned", async () => {
    const { finalizeAbandonedSessions } = await import("@/server/privacy/retention");
    const uid = makeUser("pro");
    const db = getDb();
    const a = createInterview(uid, base).sessionId;
    await drain(runOpening(a, uid));
    await drain(runTurn(a, uid, { answerText: "I led the onboarding relaunch and activation rose from 31 to 44 percent.", startMs: 1000, endMs: 20000, firstWordLatencyMs: 800, interrupted: false, inputMode: "voice", prevQuestion: null }));
    const b = createInterview(uid, base).sessionId;
    const old = new Date(Date.now() - 2 * 3600_000);
    db.update(schema.interviewSessions).set({ startedAt: old, createdAt: old }).where(eq(schema.interviewSessions.id, a)).run();
    db.update(schema.interviewSessions).set({ createdAt: old }).where(eq(schema.interviewSessions.id, b)).run();
    const done = await finalizeAbandonedSessions(30);
    expect(done).toEqual(expect.arrayContaining([a, b]));
    expect(db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, a)).get()!.status).toBe("ended");
    expect(db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, a)).get()!.analysisStatus).toBe("queued");
    expect(db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, b)).get()!.status).toBe("abandoned");
  });
});

describe("your own interviewer", () => {
  it("is seated in the look you chose and introduces itself by the name you gave it", async () => {
    const uid = makeUser("pro");
    saveStyle(uid, "skeptic", { shape: "circle", color: "midnight", accessory: "antenna", name: "Captain Byte" });
    const { sessionId: sid } = createInterview(uid, base);
    const iv = getDb().select().from(schema.interviewers).where(eq(schema.interviewers.sessionId, sid)).get()!;
    expect(iv.displayName).toBe("Captain Byte");
    expect(iv.avatarStyle).toEqual({ shape: "circle", color: "midnight", accessory: "antenna", name: "Captain Byte" });
    const events = await drain(runOpening(sid, uid));
    const text = events.find((e) => e.type === "text") as Extract<RoomEvent, { type: "text" }>;
    expect(text.text).toContain("I'm Captain Byte"); // the whole chosen name, not just "Captain"
  });

  it("keeps past sessions as they were when you restyle, and resets to the persona", () => {
    const uid = makeUser("pro");
    saveStyle(uid, "skeptic", { shape: "hexagon", color: "sky", accessory: "glasses", name: "Pixel" });
    const { sessionId: sid } = createInterview(uid, base);
    saveStyle(uid, "skeptic", null);
    expect(savedStyles(uid)).toEqual({});
    expect(getDb().select().from(schema.interviewers).where(eq(schema.interviewers.sessionId, sid)).get()!.displayName).toBe("Pixel");
    const { sessionId: fresh } = createInterview(uid, base);
    const iv = getDb().select().from(schema.interviewers).where(eq(schema.interviewers.sessionId, fresh)).get()!;
    expect(iv.displayName).toBe("Tom Hadley");
    expect(iv.avatarStyle).toBeNull();
  });
});
