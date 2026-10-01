import "server-only";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { LADDER } from "@/lib/practice/catalog";
import { compare, computeBaseline, type MetricMap } from "@/lib/practice/progress";
import { signMediaUrl } from "@/lib/security/signed-url";
import { PERSONAS, type PersonaId } from "@/lib/interview/personas";
import type { AvatarStyle } from "@/lib/avatar/style";

/** Read-side queries shared by the app pages. Every query is scoped to the user. */

export function listSessions(userId: string, limit = 50) {
  const db = getDb();
  return db.select({
    id: schema.interviewSessions.id, status: schema.interviewSessions.status, analysisStatus: schema.interviewSessions.analysisStatus,
    startedAt: schema.interviewSessions.startedAt, endedAt: schema.interviewSessions.endedAt, createdAt: schema.interviewSessions.createdAt,
    summary: schema.interviewSessions.summary, role: schema.interviews.role, type: schema.interviews.type, pressure: schema.interviews.pressure,
    mode: schema.interviews.mode, ladderLevel: schema.interviews.ladderLevel, domain: schema.interviews.domain,
  }).from(schema.interviewSessions)
    .innerJoin(schema.interviews, eq(schema.interviews.id, schema.interviewSessions.interviewId))
    .where(eq(schema.interviewSessions.userId, userId))
    .orderBy(desc(schema.interviewSessions.createdAt)).limit(limit).all();
}

export function sessionInterviewers(sessionIds: string[]) {
  type Seat = { name: string; personaId: PersonaId; style: AvatarStyle | null };
  if (!sessionIds.length) return new Map<string, Seat[]>();
  const rows = getDb().select().from(schema.interviewers).where(inArray(schema.interviewers.sessionId, sessionIds)).orderBy(asc(schema.interviewers.seat)).all();
  const map = new Map<string, Seat[]>();
  for (const r of rows) map.set(r.sessionId, [...(map.get(r.sessionId) ?? []), { name: r.displayName, personaId: r.personaId as PersonaId, style: r.avatarStyle }]);
  return map;
}

export function progressHistory(userId: string) {
  return getDb().select().from(schema.progressSnapshots)
    .where(and(eq(schema.progressSnapshots.userId, userId), isNotNull(schema.progressSnapshots.sessionId)))
    .orderBy(asc(schema.progressSnapshots.createdAt)).all();
}

export function progressSummary(userId: string) {
  const history = progressHistory(userId);
  const latest = history.at(-1) ?? null;
  const first = history[0] ?? null;
  const baseline: MetricMap = latest ? latest.baseline : {};
  const vsBaseline = latest && history.length > 1 ? compare(latest.metrics, baseline) : [];
  const vsFirst = latest && first && history.length > 1 ? compare(latest.metrics, first.metrics) : [];
  return { history, latest, first, baseline: history.length > 1 ? baseline : computeBaseline(history.map((h) => h.metrics)), vsBaseline, vsFirst };
}

export function ladderState(userId: string) {
  const rows = getDb().select().from(schema.ladderProgress).where(eq(schema.ladderProgress.userId, userId)).all();
  const byLevel = new Map(rows.map((r) => [r.level, r]));
  const steps = LADDER.map((l) => {
    const r = byLevel.get(l.level);
    return { ...l, unlocked: !!r?.unlockedAt || l.level === 1, qualifying: r?.qualifyingSessions ?? 0, completed: !!r?.completedAt };
  });
  const current = [...steps].reverse().find((s) => s.unlocked) ?? steps[0];
  return { steps, current };
}

export function recentClips(userId: string, limit = 3) {
  const db = getDb();
  const sessions = db.select({ id: schema.interviewSessions.id }).from(schema.interviewSessions)
    .where(and(eq(schema.interviewSessions.userId, userId), eq(schema.interviewSessions.analysisStatus, "complete")))
    .orderBy(desc(schema.interviewSessions.createdAt)).limit(3).all();
  if (!sessions.length) return [];
  return db.select().from(schema.playbackClips).where(inArray(schema.playbackClips.sessionId, sessions.map((s) => s.id)))
    .orderBy(asc(schema.playbackClips.rank)).limit(limit).all();
}

export function sessionDetail(sessionId: string, userId: string) {
  const db = getDb();
  const session = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get();
  if (!session || session.userId !== userId) return null;
  const interview = db.select().from(schema.interviews).where(eq(schema.interviews.id, session.interviewId)).get()!;
  const interviewers = db.select().from(schema.interviewers).where(eq(schema.interviewers.sessionId, sessionId)).orderBy(asc(schema.interviewers.seat)).all();
  const questions = db.select().from(schema.questions).where(eq(schema.questions.sessionId, sessionId)).orderBy(asc(schema.questions.seq)).all();
  const answers = db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).orderBy(asc(schema.answers.seq)).all();
  const segments = db.select().from(schema.transcriptSegments).where(eq(schema.transcriptSegments.sessionId, sessionId)).orderBy(asc(schema.transcriptSegments.startMs)).all();
  const metrics = db.select().from(schema.metrics).where(eq(schema.metrics.sessionId, sessionId)).all();
  const clips = db.select().from(schema.playbackClips).where(eq(schema.playbackClips.sessionId, sessionId)).orderBy(asc(schema.playbackClips.startMs)).all();
  const media = db.select().from(schema.mediaObjects).where(and(eq(schema.mediaObjects.sessionId, sessionId), eq(schema.mediaObjects.kind, "session_recording"))).get();
  const mediaUsable = media && media.status !== "deleted" && media.bytes > 0 && (!media.expiresAt || media.expiresAt.getTime() > Date.now());
  const snapshot = db.select().from(schema.progressSnapshots).where(eq(schema.progressSnapshots.sessionId, sessionId)).get();
  return {
    session, interview, questions, answers, segments, metrics, clips, snapshot,
    interviewers: interviewers.map((i) => ({ ...i, persona: PERSONAS[i.personaId as PersonaId] })),
    media: mediaUsable ? { id: media!.id, url: signMediaUrl(media!.id, userId, 60 * 60), mimeType: media!.mimeType, expiresAt: media!.expiresAt } : null,
    mediaDeleted: media ? !mediaUsable : false,
  };
}

/** The first session's answer to a question in the same competency — for side-by-side comparison. */
export function firstComparableAnswer(userId: string, competency: string | null, excludeSessionId: string) {
  if (!competency) return null;
  const db = getDb();
  return db.select({ answer: schema.answers.text, question: schema.questions.text, sessionId: schema.questions.sessionId, createdAt: schema.interviewSessions.createdAt })
    .from(schema.answers)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.answers.questionId))
    .innerJoin(schema.interviewSessions, eq(schema.interviewSessions.id, schema.answers.sessionId))
    .where(and(eq(schema.interviewSessions.userId, userId), eq(schema.questions.competency, competency), eq(schema.questions.kind, "primary")))
    .orderBy(asc(schema.interviewSessions.createdAt)).all()
    .find((r) => r.sessionId !== excludeSessionId) ?? null;
}
