import { z } from "zod";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { authed, json, parseBody } from "@/lib/api/http";
import { audit } from "@/lib/security/audit";
import { newId } from "@/lib/id";
import { CONSENT_VERSION } from "@/lib/privacy/consent";
import { consentTextHash } from "@/lib/privacy/consent-hash";

// Every change to a consent-bearing setting is logged as a consent record (withdrawal included).
const CONSENT_FIELDS: Record<string, string> = {
  cameraMetricsEnabled: "camera_metrics", gazeMetricEnabled: "gaze_metric", postureMetricEnabled: "posture_metric", recordVideo: "recording",
};

const Body = z.object({
  cameraMetricsEnabled: z.boolean().optional(),
  gazeMetricEnabled: z.boolean().optional(),
  postureMetricEnabled: z.boolean().optional(),
  recordVideo: z.boolean().optional(),
  videoRetentionDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).optional(),
});

export const PATCH = authed(async (req, { user }) => {
  const body = await parseBody(req, Body);
  const db = getDb();
  db.update(schema.profiles).set({ ...body, updatedAt: new Date() }).where(eq(schema.profiles.userId, user.id)).run();
  if (body.videoRetentionDays) {
    // Shortening retention applies to existing recordings too.
    const media = db.select().from(schema.mediaObjects).where(and(eq(schema.mediaObjects.userId, user.id), isNotNull(schema.mediaObjects.expiresAt))).all();
    for (const m of media) {
      const limit = new Date(m.createdAt.getTime() + body.videoRetentionDays * 86400_000);
      if (!m.expiresAt || limit < m.expiresAt) db.update(schema.mediaObjects).set({ expiresAt: limit }).where(eq(schema.mediaObjects.id, m.id)).run();
    }
  }
  for (const [field, kind] of Object.entries(CONSENT_FIELDS)) {
    const v = (body as Record<string, unknown>)[field];
    if (typeof v === "boolean") {
      db.insert(schema.consentRecords).values({ id: newId("cns"), userId: user.id, kind, version: CONSENT_VERSION, granted: v, textHash: consentTextHash(kind), source: "settings", userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null }).run();
    }
  }
  if (body.cameraMetricsEnabled === false) {
    // Withdrawal: stop using camera-derived data from here on and delete what was stored.
    const sessions = db.select({ id: schema.interviewSessions.id }).from(schema.interviewSessions).where(eq(schema.interviewSessions.userId, user.id)).all();
    for (const s of sessions) db.delete(schema.signalTimelines).where(and(eq(schema.signalTimelines.sessionId, s.id), eq(schema.signalTimelines.kind, "vision"))).run();
  }
  audit("privacy.settings", { userId: user.id, data: body });
  return json({ ok: true });
}, { limit: 30 });
