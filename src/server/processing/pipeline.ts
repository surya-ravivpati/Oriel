import "server-only";
import { and, asc, desc, eq, isNotNull, ne } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { logEvent } from "@/lib/costs/events";
import { recordTokenCost, recordUnitCost } from "@/lib/costs/record";
import { computeRead, candidateMoments, selectMoments, type AudioSample, type VisionSample, type SetupSample, type AnswerInputRow, type MetricResult } from "@/lib/analysis/read";
import { generateCoaching, type MomentForCoaching } from "@/lib/ai/analyzers";
import { getLanguageModel } from "@/lib/ai/providers/registry";
import { canUsePlayback } from "@/lib/billing/entitlements";
import { loadEntitlementContext } from "@/lib/billing/entitlement-context";
import { aboveBaseline, compare, computeBaseline, type MetricMap } from "@/lib/practice/progress";
import { LADDER, LADDER_QUALIFYING_SESSIONS } from "@/lib/practice/catalog";
import { getPack } from "@/lib/interview/domain-packs";
import { planFromSession } from "@/server/lessons";

/**
 * Session complete → store → transcript alignment → audio analysis → pose/gaze →
 * answer segmentation → competency analysis → weak moments → Playback selection →
 * coaching → progress update → lessons.
 *
 * Runs asynchronously after the interview. Each step's duration is persisted; a
 * failure marks the job failed but never touches the stored interview, so analysis
 * can be retried (admin console or the Playback page).
 */
export const PIPELINE_STEPS = [
  "store_session", "transcript_alignment", "audio_analysis", "pose_gaze_analysis", "answer_segmentation",
  "competency_analysis", "weak_moment_detection", "playback_selection", "coaching_generation", "progress_update", "lesson_planning",
] as const;

const running = new Set<string>();

export function enqueueAnalysis(sessionId: string): string {
  const db = getDb();
  const existing = db.select().from(schema.processingJobs).where(eq(schema.processingJobs.sessionId, sessionId)).orderBy(desc(schema.processingJobs.createdAt)).get();
  let jobId: string;
  if (existing && existing.status !== "complete") {
    jobId = existing.id;
    db.update(schema.processingJobs).set({ status: "queued", error: null, updatedAt: new Date() }).where(eq(schema.processingJobs.id, jobId)).run();
  } else {
    jobId = newId("job");
    db.insert(schema.processingJobs).values({ id: jobId, sessionId, status: "queued" }).run();
  }
  db.update(schema.interviewSessions).set({ analysisStatus: "queued", analysisError: null }).where(eq(schema.interviewSessions.id, sessionId)).run();
  if (process.env.ORIEL_SYNC_PIPELINE !== "1") setTimeout(() => void runJob(jobId), 0);
  return jobId;
}

export async function runJob(jobId: string): Promise<void> {
  if (running.has(jobId)) return;
  running.add(jobId);
  const db = getDb();
  const job = db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, jobId)).get();
  if (!job) return void running.delete(jobId);
  const timings: Record<string, number> = {};
  const setStep = (step: string) => db.update(schema.processingJobs).set({ step, updatedAt: new Date() }).where(eq(schema.processingJobs.id, jobId)).run();
  db.update(schema.processingJobs).set({ status: "running", attempts: job.attempts + 1, updatedAt: new Date() }).where(eq(schema.processingJobs.id, jobId)).run();
  db.update(schema.interviewSessions).set({ analysisStatus: "running" }).where(eq(schema.interviewSessions.id, job.sessionId)).run();
  const t0 = performance.now();
  let ctx: PipelineCtx | null = null;
  try {
    for (const step of PIPELINE_STEPS) {
      setStep(step);
      // Fault injection for resilience tests (never set in production).
      if (process.env.ORIEL_PIPELINE_FAIL_STEP === step) throw new Error(`injected failure at ${step}`);
      const ts = performance.now();
      ctx = await STEP_IMPL[step](job.sessionId, ctx);
      timings[step] = Math.round(performance.now() - ts);
    }
    db.update(schema.processingJobs).set({ status: "complete", step: null, stepTimings: timings, updatedAt: new Date() }).where(eq(schema.processingJobs.id, jobId)).run();
    db.update(schema.interviewSessions).set({ analysisStatus: "complete" }).where(eq(schema.interviewSessions.id, job.sessionId)).run();
    logEvent("pipeline", "analysis_complete", { sessionId: job.sessionId, durationMs: performance.now() - t0, data: timings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.update(schema.processingJobs).set({ status: "failed", error: msg, stepTimings: timings, updatedAt: new Date() }).where(eq(schema.processingJobs.id, jobId)).run();
    db.update(schema.interviewSessions).set({ analysisStatus: "failed", analysisError: msg }).where(eq(schema.interviewSessions.id, job.sessionId)).run();
    logEvent("error", "analysis_failed", { sessionId: job.sessionId, durationMs: performance.now() - t0, data: { error: msg, timings } });
  } finally {
    running.delete(jobId);
  }
}

// ─── Steps ────────────────────────────────────────────────────────────────

interface PipelineCtx {
  session: typeof schema.interviewSessions.$inferSelect;
  interview: typeof schema.interviews.$inferSelect;
  profile: typeof schema.profiles.$inferSelect | undefined;
  answers?: (typeof schema.answers.$inferSelect & { bestText: string })[];
  questions?: (typeof schema.questions.$inferSelect)[];
  audio?: AudioSample[];
  vision?: VisionSample[];
  setup?: SetupSample | null;
  rows?: AnswerInputRow[];
  read?: ReturnType<typeof computeRead>;
  competencies?: Record<string, { label: string; answers: number; avgQuality: number }>;
  moments?: ReturnType<typeof candidateMoments>;
  selected?: ReturnType<typeof selectMoments>;
}

type Step = (sessionId: string, ctx: PipelineCtx | null) => Promise<PipelineCtx>;

const STEP_IMPL: Record<(typeof PIPELINE_STEPS)[number], Step> = {
  async store_session(sessionId) {
    const db = getDb();
    const session = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get();
    if (!session) throw new Error("session missing");
    if (session.status === "live" || session.status === "created") {
      db.update(schema.interviewSessions).set({ status: "ended", endedAt: session.endedAt ?? new Date() }).where(eq(schema.interviewSessions.id, sessionId)).run();
    }
    db.update(schema.mediaObjects).set({ status: "complete" }).where(and(eq(schema.mediaObjects.sessionId, sessionId), eq(schema.mediaObjects.status, "recording"))).run();
    const interview = db.select().from(schema.interviews).where(eq(schema.interviews.id, session.interviewId)).get()!;
    const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, session.userId)).get();
    // Storage cost line for the recording.
    const media = db.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.sessionId, sessionId)).all();
    const bytes = media.reduce((a, m) => a + m.bytes, 0);
    if (bytes) recordUnitCost({ userId: session.userId, sessionId }, "local-disk", "storage", "recording_30d", bytes, "bytes", (bytes / 1e9) * 0.023);
    return { session, interview, profile };
  },

  async transcript_alignment(sessionId, ctx) {
    const db = getDb();
    const answers = db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).orderBy(asc(schema.answers.seq)).all();
    const questions = db.select().from(schema.questions).where(eq(schema.questions.sessionId, sessionId)).orderBy(asc(schema.questions.seq)).all();
    // Prefer the server transcription (keeps disfluencies) when it exists and is substantive.
    const aligned = answers.map((a) => {
      const server = a.serverText?.trim();
      const bestText = server && server.split(/\s+/).length >= Math.max(3, a.text.split(/\s+/).length * 0.5) ? server : a.text;
      if (bestText !== a.text) {
        db.update(schema.transcriptSegments).set({ text: bestText, source: "gemini" }).where(and(eq(schema.transcriptSegments.answerId, a.id), eq(schema.transcriptSegments.speaker, "candidate"))).run();
      }
      return { ...a, bestText };
    });
    return { ...ctx!, answers: aligned, questions };
  },

  async audio_analysis(sessionId, ctx) {
    const rows = getDb().select().from(schema.signalTimelines).where(and(eq(schema.signalTimelines.sessionId, sessionId), eq(schema.signalTimelines.kind, "audio"))).orderBy(asc(schema.signalTimelines.startMs)).all();
    const audio = rows.flatMap((r) => (Array.isArray(r.samples) ? (r.samples as AudioSample[]) : []))
      .filter((x) => x && typeof x.t === "number" && typeof x.rms === "number").sort((a, b) => a.t - b.t);
    return { ...ctx!, audio };
  },

  async pose_gaze_analysis(sessionId, ctx) {
    const db = getDb();
    if (!ctx!.session.cameraMetricsEnabled) return { ...ctx!, vision: [], setup: null };
    const rows = db.select().from(schema.signalTimelines).where(and(eq(schema.signalTimelines.sessionId, sessionId), eq(schema.signalTimelines.kind, "vision"))).orderBy(asc(schema.signalTimelines.startMs)).all();
    const setupRow = db.select().from(schema.signalTimelines).where(and(eq(schema.signalTimelines.sessionId, sessionId), eq(schema.signalTimelines.kind, "setup"))).orderBy(desc(schema.signalTimelines.startMs)).get();
    const vision = rows.flatMap((r) => (Array.isArray(r.samples) ? (r.samples as VisionSample[]) : [])).filter((x) => x && typeof x.t === "number").sort((a, b) => a.t - b.t);
    return { ...ctx!, vision, setup: Array.isArray(setupRow?.samples) ? ((setupRow!.samples[0] as SetupSample) ?? null) : null };
  },

  async answer_segmentation(_sessionId, ctx) {
    const qById = new Map(ctx!.questions!.map((q) => [q.id, q]));
    const rows: AnswerInputRow[] = ctx!.answers!.map((a) => {
      const q = qById.get(a.questionId);
      return {
        id: a.id, questionId: a.questionId, questionText: q?.text ?? "", questionKind: q?.kind ?? "primary",
        questionDifficulty: q?.difficulty ?? 2, questionEndMs: q?.speechEndMs ?? null, text: a.bestText,
        startMs: a.startMs, endMs: a.endMs, firstWordLatencyMs: a.firstWordLatencyMs, interrupted: a.interrupted, inputMode: a.inputMode,
      };
    });
    return { ...ctx!, rows };
  },

  async competency_analysis(sessionId, ctx) {
    const pack = getPack(ctx!.interview.domain);
    const opts = { cameraMetrics: ctx!.session.cameraMetricsEnabled, gaze: ctx!.profile?.gazeMetricEnabled ?? true, posture: ctx!.profile?.postureMetricEnabled ?? true };
    const read = computeRead(ctx!.rows!, ctx!.audio!, ctx!.vision!, ctx!.setup ?? null, opts);
    const qById = new Map(ctx!.questions!.map((q) => [q.id, q]));
    const comp: Record<string, { label: string; answers: number; avgQuality: number }> = {};
    for (const p of read.per) {
      const key = qById.get(p.answer.questionId)?.competency;
      if (!key) continue;
      const label = pack.competencies.find((c) => c.key === key)?.label ?? key;
      const c = (comp[key] ??= { label, answers: 0, avgQuality: 0 });
      c.avgQuality = (c.avgQuality * c.answers + p.h.quality) / (c.answers + 1);
      c.answers += 1;
    }
    return { ...ctx!, read, competencies: comp };
  },

  async weak_moment_detection(_sessionId, ctx) {
    const opts = { cameraMetrics: ctx!.session.cameraMetricsEnabled, gaze: ctx!.profile?.gazeMetricEnabled ?? true, posture: ctx!.profile?.postureMetricEnabled ?? true };
    return { ...ctx!, moments: candidateMoments(ctx!.read!.per, opts) };
  },

  async playback_selection(_sessionId, ctx) {
    const { maxClips } = canUsePlayback(loadEntitlementContext(ctx!.session.userId));
    return { ...ctx!, selected: selectMoments(ctx!.moments!, maxClips) };
  },

  async coaching_generation(sessionId, ctx) {
    const db = getDb();
    const c = ctx!;
    const rowById = new Map(c.rows!.map((r) => [r.id, r]));
    const momentsForCoaching: MomentForCoaching[] = c.selected!.map((m, i) => {
      const r = rowById.get(m.answerId)!;
      return { id: String(i), question: r.questionText, transcript: r.text.slice(0, 1200), signal: m.signal, evidence: m.evidence };
    });
    const weakest = [...c.read!.per].filter((p) => p.h.wordCount >= 40 && p.answer.questionKind !== "closing").sort((a, b) => a.h.quality - b.h.quality)[0];
    const metricsSummary = c.read!.metrics.map((m) => `${m.label}: ${m.value ?? "n/a"} ${m.unit} (${m.confidence})`).join("; ");
    const llm = getLanguageModel();
    const coaching = await generateCoaching(llm, {
      role: c.interview.role, moments: momentsForCoaching, metricsSummary,
      weakestAnswer: weakest && canUsePlayback(loadEntitlementContext(c.session.userId)).level === "full" ? { question: weakest.answer.questionText, answer: weakest.answer.text } : null,
    });
    if (coaching.usage) recordTokenCost({ userId: c.session.userId, sessionId }, llm.id, "analysis", "coaching_generator", coaching.usage);
    logEvent("llm_output", "coaching_generator", { sessionId, durationMs: coaching.latencyMs, data: { source: coaching.source, output: coaching.data, error: coaching.error ?? null } });

    db.transaction((tx) => {
      tx.delete(schema.playbackClips).where(eq(schema.playbackClips.sessionId, sessionId)).run();
      c.selected!.forEach((m, i) => {
        const r = rowById.get(m.answerId)!;
        const cm = coaching.data.moments.find((x) => x.id === String(i));
        tx.insert(schema.playbackClips).values({
          id: newId("clp"), sessionId, questionId: m.questionId, answerId: m.answerId, rank: i, startMs: m.startMs, endMs: m.endMs,
          title: cm?.title ?? m.signal, questionText: r.questionText, transcript: r.text.slice(0, 600),
          // Observed text is always the measured evidence; the model may only add the title and the suggestion.
          observed: m.evidence, suggestion: cm?.suggestion ?? "Try: lead with the point, then the evidence.",
          signal: m.signal, confidence: m.confidence, source: coaching.source,
        }).run();
      });
      tx.update(schema.interviewSessions).set({
        summary: {
          headline: coaching.data.headline, strengths: coaching.data.strengths, focus: coaching.data.focus,
          rewrittenAnswer: coaching.data.rewrite && weakest ? { questionId: weakest.answer.questionId, ...coaching.data.rewrite } : null,
          source: coaching.source,
        },
      }).where(eq(schema.interviewSessions.id, sessionId)).run();
    });
    return c;
  },

  async progress_update(sessionId, ctx) {
    const db = getDb();
    const c = ctx!;
    const userId = c.session.userId;
    db.delete(schema.metrics).where(eq(schema.metrics.sessionId, sessionId)).run();
    const toRow = (m: MetricResult): typeof schema.metrics.$inferInsert => ({
      id: newId("met"), sessionId, userId, key: m.key, value: m.value, low: m.low, high: m.high, unit: m.unit,
      confidence: m.confidence, targetLow: m.targetLow, targetHigh: m.targetHigh, detail: { label: m.label, note: m.note, ...(m.detail ?? {}) },
    });
    const rows = c.read!.metrics.map(toRow);
    rows.push({ id: newId("met"), sessionId, userId, key: "competencies", value: null, low: null, high: null, unit: "", confidence: "medium", targetLow: null, targetHigh: null, detail: { label: "Competencies", note: "", competencies: c.competencies } });
    if (rows.length) db.insert(schema.metrics).values(rows).run();

    const current: MetricMap = Object.fromEntries(c.read!.metrics.map((m) => [m.key, m.value]));
    const prior = db.select().from(schema.progressSnapshots).where(and(eq(schema.progressSnapshots.userId, userId), isNotNull(schema.progressSnapshots.sessionId), ne(schema.progressSnapshots.sessionId, sessionId))).orderBy(asc(schema.progressSnapshots.createdAt)).all();
    const baseline = computeBaseline(prior.map((p) => p.metrics));
    db.delete(schema.progressSnapshots).where(eq(schema.progressSnapshots.sessionId, sessionId)).run();
    db.insert(schema.progressSnapshots).values({ id: newId("prg"), userId, sessionId, metrics: current, baseline }).run();

    // Ladder: qualifying sessions on the current rung unlock the next one.
    const level = c.interview.ladderLevel;
    if (level && prior.length) {
      const { above } = aboveBaseline(compare(current, baseline));
      if (above) {
        const prog = db.select().from(schema.ladderProgress).where(and(eq(schema.ladderProgress.userId, userId), eq(schema.ladderProgress.level, level))).get();
        const qualifying = (prog?.qualifyingSessions ?? 0) + 1;
        if (prog) db.update(schema.ladderProgress).set({ qualifyingSessions: qualifying, completedAt: qualifying >= LADDER_QUALIFYING_SESSIONS ? prog.completedAt ?? new Date() : null }).where(and(eq(schema.ladderProgress.userId, userId), eq(schema.ladderProgress.level, level))).run();
        if (qualifying >= LADDER_QUALIFYING_SESSIONS && LADDER.some((l) => l.level === level + 1)) {
          db.insert(schema.ladderProgress).values({ userId, level: level + 1, qualifyingSessions: 0, unlockedAt: new Date() }).onConflictDoNothing().run();
          logEvent("pipeline", "ladder_unlocked", { sessionId, userId, data: { level: level + 1 } });
        }
      }
    }
    return c;
  },

  async lesson_planning(sessionId, ctx) {
    const c = ctx!;
    await planFromSession({ userId: c.session.userId, sessionId, role: c.interview.role, metrics: c.read!.metrics, per: c.read!.per });
    return c;
  },
};
