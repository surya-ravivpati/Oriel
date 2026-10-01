import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { authed, HttpError, json, parseBody, type IdParams } from "@/lib/api/http";
import { audit } from "@/lib/security/audit";
import { CONSENT_VERSION } from "@/lib/privacy/consent";
import { consentTextHash } from "@/lib/privacy/consent-hash";
import { loadSession } from "@/server/interview/service";

const Body = z.object({
  consents: z.array(z.object({ kind: z.enum(["camera", "microphone", "recording", "camera_metrics", "ai_disclosure"]), granted: z.boolean() })).min(1).max(5),
  version: z.string(),
  /** Typed full name — the written release required before camera-derived signals are computed. */
  signature: z.string().trim().max(120).optional(),
});

/** Logs the exact consent version and wording hash shown in the pre-Room consent dialog. */
export const POST = authed<IdParams>(async (req, { params, user }) => {
  const { id } = await params;
  loadSession(id, user.id);
  const body = await parseBody(req, Body);
  if (body.version !== CONSENT_VERSION) throw new HttpError(409, "The consent wording changed — please reload and review it again.", "consent_version");
  const metrics = body.consents.find((c) => c.kind === "camera_metrics");
  if (metrics?.granted && (!body.signature || body.signature.length < 2)) {
    throw new HttpError(400, "Type your full name to sign, or turn camera-based signals off.", "signature_required");
  }
  const db = getDb();
  const ua = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  for (const c of body.consents) {
    db.insert(schema.consentRecords).values({
      id: newId("cns"), userId: user.id, sessionId: id, kind: c.kind, version: CONSENT_VERSION, granted: c.granted, userAgent: ua,
      textHash: consentTextHash(c.kind), signature: c.kind === "camera_metrics" && c.granted ? body.signature ?? null : null, source: "room_consent",
    }).run();
  }
  const camera = body.consents.find((c) => c.kind === "camera");
  if ((metrics && !metrics.granted) || (camera && !camera.granted)) {
    db.update(schema.interviewSessions).set({ cameraMetricsEnabled: false }).where(eq(schema.interviewSessions.id, id)).run();
  }
  audit("consent.session", { userId: user.id, target: id, data: { consents: body.consents, version: CONSENT_VERSION, signed: !!body.signature } });
  return json({ ok: true });
}, { limit: 20 });
