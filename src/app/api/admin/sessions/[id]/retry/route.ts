import { authed, json, type IdParams } from "@/lib/api/http";
import { enqueueAnalysis } from "@/server/processing/pipeline";
import { audit } from "@/lib/security/audit";

// Analysis runs after the response; give it room to finish on serverless hosts.
export const maxDuration = 300;

export const POST = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  await audit("admin.analysis_retry", { userId: user.id, target: id });
  return json({ ok: true, jobId: await enqueueAnalysis(id) });
}, { admin: true, limit: 30 });
