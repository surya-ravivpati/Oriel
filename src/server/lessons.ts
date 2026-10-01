import "server-only";
import { and, desc, eq, gte, ne } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { logEvent } from "@/lib/costs/events";
import { recordTokenCost } from "@/lib/costs/record";
import { getLanguageModel } from "@/lib/ai/providers/registry";
import { writeLessons } from "@/lib/ai/lesson-writer";
import { LESSONS, PRACTICE_PASSES_NEEDED } from "@/lib/lessons/library";
import { MAX_ACTIVE, assess, planLessons, type PlannerInput } from "@/lib/lessons/planner";
import type { LessonKey } from "@/lib/lessons/types";

const MAX_PER_TRACK = 2;

export type LessonRow = typeof schema.lessons.$inferSelect;

/**
 * After an interview is analysed: plan the lessons it shows a need for, refresh the ones
 * already open with this interview's evidence, and mark lessons mastered when the skill
 * is now on target. Skills this interview couldn't measure are left as they were.
 */
export async function planFromSession(input: PlannerInput & { userId: string; role: string }) {
  const db = getDb();
  const plan = planLessons(input);
  const measured = new Map(assess(input).map((a) => [a.key, a]));
  const existing = new Map(db.select().from(schema.lessons).where(eq(schema.lessons.userId, input.userId)).all().map((l) => [l.lessonKey as LessonKey, l]));

  const llm = getLanguageModel();
  const written = await writeLessons(llm, { role: input.role, lessons: plan });
  if (written.usage) recordTokenCost({ userId: input.userId, sessionId: input.sessionId }, llm.id, "analysis", "lesson_writer", written.usage);
  logEvent("llm_output", "lesson_writer", { sessionId: input.sessionId, userId: input.userId, durationMs: written.latencyMs, data: { source: written.source, lessons: plan.map((p) => p.key), error: written.error ?? null } });

  const now = new Date();
  db.transaction((tx) => {
    for (const p of plan) {
      const content = written.data[p.key];
      const fields = { track: p.track, priority: p.priority, sourceSessionId: input.sessionId, metricKey: p.metricKey, latestValue: p.value, evidence: p.evidence, content, updatedAt: now };
      const ex = existing.get(p.key);
      if (!ex) {
        tx.insert(schema.lessons).values({ id: newId("lsn"), userId: input.userId, lessonKey: p.key, status: p.status, startValue: p.value, ...fields }).run();
      } else if (ex.status === "mastered") {
        // It slipped again: a fresh round of practice.
        tx.update(schema.lessons).set({ ...fields, status: p.status, startValue: p.value, masteredAt: null, practicePasses: 0, practiceAttempts: 0, viewedAt: null }).where(eq(schema.lessons.id, ex.id)).run();
      } else {
        tx.update(schema.lessons).set({ ...fields, status: p.status }).where(eq(schema.lessons.id, ex.id)).run();
      }
    }
    for (const [key, ex] of existing) {
      if (ex.status === "mastered" || plan.some((p) => p.key === key)) continue;
      const a = measured.get(key);
      if (a && a.need <= 0.05) tx.update(schema.lessons).set({ status: "mastered", masteredAt: now, latestValue: a.value, updatedAt: now }).where(eq(schema.lessons.id, ex.id)).run();
    }
  });
  rebalance(input.userId);
  logEvent("pipeline", "lessons_planned", { sessionId: input.sessionId, userId: input.userId, data: { planned: plan.map((p) => `${p.key}:${p.status}`) } });
}

/** Keep the open plan focused: the highest-priority few are active, spread across tracks; the rest wait. */
function rebalance(userId: string) {
  const db = getDb();
  const open = db.select().from(schema.lessons).where(and(eq(schema.lessons.userId, userId), ne(schema.lessons.status, "mastered"))).orderBy(desc(schema.lessons.priority)).all();
  const perTrack: Record<string, number> = {};
  let active = 0;
  for (const l of open) {
    const take = active < MAX_ACTIVE && (perTrack[l.track] ?? 0) < MAX_PER_TRACK;
    if (take) { active++; perTrack[l.track] = (perTrack[l.track] ?? 0) + 1; }
    const status = take ? "active" : "queued";
    if (status !== l.status) db.update(schema.lessons).set({ status }).where(eq(schema.lessons.id, l.id)).run();
  }
}

/** A drill attempt counts as practice for the open lesson that uses that drill. */
export function recordLessonPractice(userId: string, drillId: string, passed: boolean | null) {
  const db = getDb();
  const key = (Object.keys(LESSONS) as LessonKey[]).find((k) => LESSONS[k].drillId === drillId);
  if (!key) return null;
  return bumpPractice(db, userId, key, passed);
}

/** Practice without a drill (the setup check). */
export function recordSetupCheck(userId: string, passed: boolean) {
  return bumpPractice(getDb(), userId, "setup", passed);
}

function bumpPractice(db: ReturnType<typeof getDb>, userId: string, key: LessonKey, passed: boolean | null) {
  const l = db.select().from(schema.lessons).where(and(eq(schema.lessons.userId, userId), eq(schema.lessons.lessonKey, key), ne(schema.lessons.status, "mastered"))).get();
  if (!l) return null;
  const passes = l.practicePasses + (passed ? 1 : 0);
  db.update(schema.lessons).set({ practiceAttempts: l.practiceAttempts + 1, practicePasses: passes, updatedAt: new Date() }).where(eq(schema.lessons.id, l.id)).run();
  return { key, title: LESSONS[key].title, passes, needed: PRACTICE_PASSES_NEEDED };
}

export function lessonsFor(userId: string): LessonRow[] {
  const rows = getDb().select().from(schema.lessons).where(eq(schema.lessons.userId, userId)).all();
  const rank = { active: 0, queued: 1, mastered: 2 } as const;
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || b.priority - a.priority);
}

export function lessonFor(userId: string, key: string) {
  const db = getDb();
  const lesson = db.select().from(schema.lessons).where(and(eq(schema.lessons.userId, userId), eq(schema.lessons.lessonKey, key))).get();
  if (!lesson) return null;
  const drillId = LESSONS[key as LessonKey]?.drillId;
  const attempts = drillId
    ? db.select().from(schema.drillAttempts).where(and(eq(schema.drillAttempts.userId, userId), eq(schema.drillAttempts.drillId, drillId), gte(schema.drillAttempts.createdAt, lesson.createdAt))).orderBy(desc(schema.drillAttempts.createdAt)).limit(6).all()
    : [];
  if (!lesson.viewedAt) db.update(schema.lessons).set({ viewedAt: new Date() }).where(eq(schema.lessons.id, lesson.id)).run();
  const recorded = !!lesson.sourceSessionId && !!db.select({ id: schema.mediaObjects.id }).from(schema.mediaObjects)
    .where(and(eq(schema.mediaObjects.sessionId, lesson.sourceSessionId), eq(schema.mediaObjects.status, "complete"))).get();
  return { lesson, attempts, recorded };
}

export function nextLesson(userId: string): LessonRow | null {
  return lessonsFor(userId).find((l) => l.status === "active") ?? null;
}

