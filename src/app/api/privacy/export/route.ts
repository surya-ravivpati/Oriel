import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { authed } from "@/lib/api/http";
import { audit } from "@/lib/security/audit";

/** Download everything Oriel stores about you (except encrypted video, which is in Playback). */
export const GET = authed(async (_req, { user }) => {
  const db = getDb();
  const sessions = await db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.userId, user.id)).all();
  const bySession = (t: typeof schema.answers | typeof schema.questions | typeof schema.playbackClips | typeof schema.transcriptSegments) =>
    Promise.all(sessions.map((s) => db.select().from(t).where(eq(t.sessionId, s.id)).all())).then((rows) => rows.flat());
  const data = {
    exportedAt: new Date().toISOString(),
    user: { email: user.email },
    profile: await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get(),
    resumes: await db.select().from(schema.resumes).where(eq(schema.resumes.userId, user.id)).all(),
    jobDescriptions: await db.select().from(schema.jobDescriptions).where(eq(schema.jobDescriptions.userId, user.id)).all(),
    sessions, questions: await bySession(schema.questions), answers: await bySession(schema.answers), transcript: await bySession(schema.transcriptSegments), playback: await bySession(schema.playbackClips),
    metrics: await db.select().from(schema.metrics).where(eq(schema.metrics.userId, user.id)).all(),
    drills: await db.select().from(schema.drillAttempts).where(eq(schema.drillAttempts.userId, user.id)).all(),
    lessons: await db.select().from(schema.lessons).where(eq(schema.lessons.userId, user.id)).all(),
    consent: await db.select().from(schema.consentRecords).where(eq(schema.consentRecords.userId, user.id)).all(),
  };
  await audit("privacy.export", { userId: user.id });
  return new Response(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="oriel-export.json"` } });
}, { limit: 5 });
