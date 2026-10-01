import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

/** Aggregates for the admin console. */
export function adminOverview() {
  const db = getDb();
  const sessions = db.select({
    id: schema.interviewSessions.id, createdAt: schema.interviewSessions.createdAt, status: schema.interviewSessions.status,
    analysis: schema.interviewSessions.analysisStatus, llm: schema.interviewSessions.llmProvider, tts: schema.interviewSessions.ttsProvider,
    avatar: schema.interviewSessions.avatarProvider, degraded: schema.interviewSessions.degradedMode, email: schema.users.email,
    role: schema.interviews.role, mode: schema.interviews.mode, pressure: schema.interviews.pressure,
    startedAt: schema.interviewSessions.startedAt, endedAt: schema.interviewSessions.endedAt,
  }).from(schema.interviewSessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.interviewSessions.userId))
    .innerJoin(schema.interviews, eq(schema.interviews.id, schema.interviewSessions.interviewId))
    .orderBy(desc(schema.interviewSessions.createdAt)).limit(100).all();
  const costBySession = new Map(db.select({ s: schema.costRecords.sessionId, usd: sql<number>`sum(${schema.costRecords.usd})` }).from(schema.costRecords).groupBy(schema.costRecords.sessionId).all().map((r) => [r.s, r.usd]));
  const costByCategory = db.select({ category: schema.costRecords.category, provider: schema.costRecords.provider, usd: sql<number>`sum(${schema.costRecords.usd})`, units: sql<number>`sum(${schema.costRecords.units})`, unit: schema.costRecords.unitName })
    .from(schema.costRecords).groupBy(schema.costRecords.category, schema.costRecords.provider, schema.costRecords.unitName).all();
  const latencyRows = db.select({ name: schema.providerEvents.name, d: schema.providerEvents.durationMs }).from(schema.providerEvents).where(eq(schema.providerEvents.type, "latency")).orderBy(desc(schema.providerEvents.createdAt)).limit(2000).all();
  const latency = new Map<string, number[]>();
  for (const r of latencyRows) if (r.d !== null && r.d >= 0) latency.set(r.name, [...(latency.get(r.name) ?? []), r.d]);
  const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
  const latencySummary = [...latency.entries()].map(([name, xs]) => ({ name, n: xs.length, p50: pct(xs, 0.5), p90: pct(xs, 0.9) }));
  // Client-perceived turn latency is stored in turn_server event data (prevPerceivedMs) and in summaries.
  const turnEvents = db.select({ data: schema.providerEvents.data }).from(schema.providerEvents).where(eq(schema.providerEvents.name, "turn_server")).orderBy(desc(schema.providerEvents.createdAt)).limit(1000).all();
  const perceived = turnEvents.map((e) => (e.data as Record<string, number> | null)?.prevPerceivedMs).filter((v): v is number => typeof v === "number" && v >= 0);
  latencySummary.push({ name: "turn_perceived (client: end of speech → first interviewer audio, excl. intentional silence)", n: perceived.length, p50: pct(perceived, 0.5), p90: pct(perceived, 0.9) });
  const errors = db.select().from(schema.providerEvents).where(sql`${schema.providerEvents.type} in ('error','fallback')`).orderBy(desc(schema.providerEvents.createdAt)).limit(30).all();
  const jobs = db.select({ status: schema.processingJobs.status, n: sql<number>`count(*)` }).from(schema.processingJobs).groupBy(schema.processingJobs.status).all();
  return { sessions: sessions.map((s) => ({ ...s, usd: costBySession.get(s.id) ?? 0 })), costByCategory, latencySummary, errors, jobs };
}

export function adminSession(id: string) {
  const db = getDb();
  const session = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, id)).get();
  if (!session) return null;
  return {
    session,
    interview: db.select().from(schema.interviews).where(eq(schema.interviews.id, session.interviewId)).get()!,
    events: db.select().from(schema.providerEvents).where(eq(schema.providerEvents.sessionId, id)).orderBy(asc(schema.providerEvents.createdAt)).all(),
    costs: db.select().from(schema.costRecords).where(eq(schema.costRecords.sessionId, id)).all(),
    questions: db.select().from(schema.questions).where(eq(schema.questions.sessionId, id)).orderBy(asc(schema.questions.seq)).all(),
    answers: db.select().from(schema.answers).where(eq(schema.answers.sessionId, id)).orderBy(asc(schema.answers.seq)).all(),
    claims: db.select().from(schema.claims).where(eq(schema.claims.sessionId, id)).all(),
    metrics: db.select().from(schema.metrics).where(eq(schema.metrics.sessionId, id)).all(),
    clips: db.select().from(schema.playbackClips).where(eq(schema.playbackClips.sessionId, id)).orderBy(asc(schema.playbackClips.startMs)).all(),
    jobs: db.select().from(schema.processingJobs).where(eq(schema.processingJobs.sessionId, id)).all(),
    signals: db.select({ kind: schema.signalTimelines.kind, n: sql<number>`count(*)` }).from(schema.signalTimelines).where(eq(schema.signalTimelines.sessionId, id)).groupBy(schema.signalTimelines.kind).all(),
    media: db.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.sessionId, id)).all(),
  };
}
