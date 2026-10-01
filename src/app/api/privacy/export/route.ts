import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { authed } from "@/lib/api/http";
import { audit } from "@/lib/security/audit";

/** Download everything Oriel stores about you (except encrypted video, which is in Playback). */
export const GET = authed(async (_req, { user }) => {
  const db = getDb();
  const sessions = db.select().from(schema.interviewSessions).where(eq(schema.interviewSessions.userId, user.id)).all();
  const bySession = (t: typeof schema.answers | typeof schema.questions | typeof schema.playbackClips | typeof schema.transcriptSegments) =>
    sessions.flatMap((s) => db.select().from(t).where(eq(t.sessionId, s.id)).all());
  const data = {
    exportedAt: new Date().toISOString(),
    user: { email: user.email },
    profile: db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get(),
    resumes: db.select().from(schema.resumes).where(eq(schema.resumes.userId, user.id)).all(),
    jobDescriptions: db.select().from(schema.jobDescriptions).where(eq(schema.jobDescriptions.userId, user.id)).all(),
    sessions, questions: bySession(schema.questions), answers: bySession(schema.answers), transcript: bySession(schema.transcriptSegments), playback: bySession(schema.playbackClips),
    metrics: db.select().from(schema.metrics).where(eq(schema.metrics.userId, user.id)).all(),
    drills: db.select().from(schema.drillAttempts).where(eq(schema.drillAttempts.userId, user.id)).all(),
    lessons: db.select().from(schema.lessons).where(eq(schema.lessons.userId, user.id)).all(),
    consent: db.select().from(schema.consentRecords).where(eq(schema.consentRecords.userId, user.id)).all(),
  };
  audit("privacy.export", { userId: user.id });
  return new Response(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="oriel-export.json"` } });
}, { limit: 5 });
