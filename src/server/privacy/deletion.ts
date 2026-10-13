import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { audit } from "@/lib/security/audit";
import { deleteAllMediaForUser, deleteMedia } from "@/lib/privacy/media-store";

/** Permanently delete one session: encrypted recording files first, then all rows (FK cascade). */
export async function deleteSession(userId: string, sessionId: string): Promise<boolean> {
  const db = getDb();
  const session = await db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.id, sessionId)).get();
  if (!session || session.userId !== userId) return false;
  for (const m of await db.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.sessionId, sessionId)).all()) await deleteMedia(userId, m.id);
  await db.delete(schema.progressSnapshots).where(eq(schema.progressSnapshots.sessionId, sessionId)).run();
  await db.delete(schema.costRecords).where(eq(schema.costRecords.sessionId, sessionId)).run();
  await db.delete(schema.providerEvents).where(eq(schema.providerEvents.sessionId, sessionId)).run();
  await db.delete(schema.interviews).where(eq(schema.interviews.id, session.interviewId)).run(); // cascades to session, questions, answers, clips…
  await audit("privacy.session_deleted", { userId, target: sessionId });
  return true;
}

/** Delete the account and everything it owns. The audit entry (no personal content) is kept. */
export async function deleteAccount(userId: string, emailDomain: string | null) {
  await deleteAllMediaForUser(userId);
  const db = getDb();
  await db.delete(schema.costRecords).where(eq(schema.costRecords.userId, userId)).run();
  await db.delete(schema.providerEvents).where(eq(schema.providerEvents.userId, userId)).run();
  await db.delete(schema.users).where(eq(schema.users.id, userId)).run();
  await audit("privacy.account_deleted", { userId, data: { email_domain: emailDomain } });
}
