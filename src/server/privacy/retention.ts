import { and, lt, ne, isNotNull, eq, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { deleteMedia } from "@/lib/privacy/media-store";
import { audit } from "@/lib/security/audit";

/**
 * Retention schedule (published at /privacy):
 *  - raw video/audio recording: user's retention setting (default 30 days), then deleted
 *  - frame-level derived signals (camera + audio timelines): deleted with the raw video
 *  - aggregate Read metrics, transcript, Playback text: kept until the user deletes them
 *  - accounts with no sign-in for 3 years: deleted entirely
 */
export async function sweepExpiredMedia(now = new Date()): Promise<number> {
  const db = getDb();
  // Frame-level derived signals go when the session's raw-video retention ends.
  const expiredSessions = await db.select({ id: schema.interviewSessions.id }).from(schema.interviewSessions)
    .where(and(isNotNull(schema.interviewSessions.videoExpiresAt), lt(schema.interviewSessions.videoExpiresAt, now))).all();
  for (const s of expiredSessions) await db.delete(schema.signalTimelines).where(eq(schema.signalTimelines.sessionId, s.id)).run();
  const expired = await db.select().from(schema.mediaObjects).where(and(isNotNull(schema.mediaObjects.expiresAt), lt(schema.mediaObjects.expiresAt, now), ne(schema.mediaObjects.status, "deleted"))).all();
  for (const m of expired) {
    await deleteMedia(m.userId, m.id);
    await db.update(schema.mediaObjects).set({ status: "deleted", bytes: 0 }).where(eq(schema.mediaObjects.id, m.id)).run();
    await audit("privacy.retention_delete", { userId: m.userId, target: m.id });
  }
  return expired.length;
}

/**
 * Sessions left "live" (tab closed, crash) are finalised after `idleMinutes` without
 * activity, and their Read is queued — nothing the candidate said is lost.
 */
export async function finalizeAbandonedSessions(idleMinutes = 30, now = new Date()): Promise<string[]> {
  const db = getDb();
  const cutoff = now.getTime() - idleMinutes * 60_000;
  const live = await db.select().from(schema.interviewSessions).where(inArray(schema.interviewSessions.status, ["live", "created"])).all();
  const finalized: string[] = [];
  for (const s of live) {
    const lastQ = await db.select({ at: schema.questions.askedAtMs }).from(schema.questions).where(eq(schema.questions.sessionId, s.id)).orderBy(desc(schema.questions.seq)).get();
    const startedAt = (s.startedAt ?? s.createdAt).getTime();
    const lastActivity = startedAt + (lastQ?.at ?? 0);
    if (lastActivity > cutoff) continue;
    const answered = await db.select({ id: schema.answers.id }).from(schema.answers).where(eq(schema.answers.sessionId, s.id)).get();
    await db.update(schema.interviewSessions).set({ status: answered ? "ended" : "abandoned", endedAt: new Date(lastActivity) }).where(eq(schema.interviewSessions.id, s.id)).run();
    if (answered) {
      const { enqueueAnalysis } = await import("@/server/processing/pipeline");
      await enqueueAnalysis(s.id);
    }
    await audit("interview.auto_finalized", { userId: s.userId, target: s.id, data: { answered: !!answered } });
    finalized.push(s.id);
  }
  return finalized;
}

/** Delete accounts with no sign-in for `years` (BIPA's outer limit is 3 years from last interaction). */
export async function deleteInactiveAccounts(years = 3, now = new Date()): Promise<number> {
  const { deleteAccount } = await import("./deletion");
  const db = getDb();
  const cutoff = new Date(now.getTime() - years * 365 * 86400_000);
  let n = 0;
  for (const u of await db.select().from(schema.users).all()) {
    const lastLogin = await db.select({ at: schema.authSessions.createdAt }).from(schema.authSessions).where(eq(schema.authSessions.userId, u.id)).orderBy(desc(schema.authSessions.createdAt)).get();
    const lastSession = await db.select({ at: schema.interviewSessions.createdAt }).from(schema.interviewSessions).where(eq(schema.interviewSessions.userId, u.id)).orderBy(desc(schema.interviewSessions.createdAt)).get();
    const last = Math.max(u.createdAt.getTime(), lastLogin?.at.getTime() ?? 0, lastSession?.at.getTime() ?? 0);
    if (last < cutoff.getTime()) {
      await deleteAccount(u.id, u.email.split("@")[1] ?? null);
      await audit("privacy.inactive_account_deleted", { userId: u.id });
      n++;
    }
  }
  return n;
}
