import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { authed, json, type IdParams } from "@/lib/api/http";
import { enqueueAnalysis } from "@/server/processing/pipeline";
import { loadSession } from "@/server/interview/service";

/** Analysis status for the "processing" screen. */
export const GET = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  const { session } = loadSession(id, user.id);
  const job = getDb().select().from(schema.processingJobs).where(eq(schema.processingJobs.sessionId, id)).orderBy(desc(schema.processingJobs.createdAt)).get();
  return json({ status: session.analysisStatus, step: job?.step ?? null, error: session.analysisError });
}, { limit: 240, name: "analysis-status" });

/** Retry analysis. Never re-runs the interview; only reprocesses stored data. */
export const POST = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  loadSession(id, user.id);
  return json({ ok: true, jobId: enqueueAnalysis(id) });
}, { limit: 10, name: "analysis-retry" });
