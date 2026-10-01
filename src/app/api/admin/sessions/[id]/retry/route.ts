import { authed, json, type IdParams } from "@/lib/api/http";
import { enqueueAnalysis } from "@/server/processing/pipeline";
import { audit } from "@/lib/security/audit";

export const POST = authed<IdParams>(async (_req, { params, user }) => {
  const { id } = await params;
  audit("admin.analysis_retry", { userId: user.id, target: id });
  return json({ ok: true, jobId: enqueueAnalysis(id) });
}, { admin: true, limit: 30 });
