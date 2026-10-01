import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { authed, json, parseBody, type IdParams } from "@/lib/api/http";
import { audit } from "@/lib/security/audit";
import { logEvent } from "@/lib/costs/events";
import { avatarMinuteRate, recordUnitCost } from "@/lib/costs/record";
import { enqueueAnalysis } from "@/server/processing/pipeline";
import { loadSession } from "@/server/interview/service";

const Body = z.object({
  reason: z.enum(["completed", "ended_early", "disconnected"]),
  durationMs: z.number().min(0).max(4 * 3600_000),
  avatarProvider: z.string().max(40),
  degradedMode: z.enum(["voice", "text"]).nullable(),
  clientLatency: z.object({ turns: z.number(), medianMs: z.number().nullable(), p90Ms: z.number().nullable() }).optional(),
});

/** End the session (idempotent) and queue the Read. The interview data is already stored turn by turn. */
export const POST = authed<IdParams>(async (req, { params, user }) => {
  const { id } = await params;
  const { session } = loadSession(id, user.id);
  const body = await parseBody(req, Body);
  const db = getDb();
  if (session.status !== "ended") {
    const minutes = body.durationMs / 60000;
    db.update(schema.interviewSessions).set({ status: "ended", endedAt: new Date(), avatarProvider: body.avatarProvider, degradedMode: body.degradedMode, phase: "COMPLETE" }).where(eq(schema.interviewSessions.id, id)).run();
    const avatarKey = body.avatarProvider === "local" ? "avatar-local" : "avatar-managed-premium";
    recordUnitCost({ userId: user.id, sessionId: id }, body.avatarProvider, "avatar", "interviewer_minutes", minutes, "minutes", minutes * avatarMinuteRate(avatarKey));
    if (body.avatarProvider !== "local") db.insert(schema.usageRecords).values({ id: newId("use"), userId: user.id, sessionId: id, kind: "managed_avatar_minutes", quantity: minutes }).run();
    db.insert(schema.usageRecords).values({ id: newId("use"), userId: user.id, sessionId: id, kind: "avatar_minutes", quantity: minutes }).run();
    if (body.clientLatency) logEvent("latency", "turn_perceived_summary", { sessionId: id, userId: user.id, durationMs: body.clientLatency.medianMs ?? undefined, data: body.clientLatency });
    audit("interview.complete", { userId: user.id, target: id, data: { reason: body.reason, minutes: Math.round(minutes * 10) / 10 } });
  }
  const jobId = enqueueAnalysis(id);
  return json({ ok: true, jobId });
}, { limit: 20 });
