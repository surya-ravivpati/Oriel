import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { authed, HttpError, json, type IdParams } from "@/lib/api/http";
import { appendSegment, createMedia } from "@/lib/privacy/media-store";
import { loadSession } from "@/server/interview/service";

const MAX_CHUNK = 12 * 1024 * 1024;
const ALLOWED = /^(video|audio)\/(webm|mp4)(;.*)?$/;

/** Append one MediaRecorder chunk (?seq=n) to the session recording. Encrypted at rest. */
export const POST = authed<IdParams>(async (req, { params, user }) => {
  const { id } = await params;
  const { session, profile } = loadSession(id, user.id);
  if (profile && !profile.recordVideo) throw new HttpError(403, "Recording is turned off in your privacy settings");
  const seq = Number(new URL(req.url).searchParams.get("seq"));
  if (!Number.isInteger(seq) || seq < 0) throw new HttpError(400, "Missing seq");
  const mime = req.headers.get("x-media-type") ?? "video/webm";
  if (!ALLOWED.test(mime)) throw new HttpError(415, "Unsupported media type");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) return json({ ok: true, empty: true });
  if (buf.length > MAX_CHUNK) throw new HttpError(413, "Chunk too large");
  const db = getDb();
  let media = db.select().from(schema.mediaObjects).where(and(eq(schema.mediaObjects.sessionId, id), eq(schema.mediaObjects.kind, "session_recording"))).get();
  if (!media) {
    const mediaId = newId("med");
    const storageKey = createMedia(user.id, mediaId, mime);
    db.insert(schema.mediaObjects).values({ id: mediaId, userId: user.id, sessionId: id, kind: "session_recording", mimeType: mime, storageKey, expiresAt: session.videoExpiresAt }).run();
    media = db.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.id, mediaId)).get()!;
  }
  if (media.status === "deleted") throw new HttpError(410, "Recording was deleted");
  let r;
  try {
    r = appendSegment(user.id, media.id, seq, buf);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("out-of-order")) throw new HttpError(409, err.message, "out_of_order");
    throw err;
  }
  db.update(schema.mediaObjects).set({ bytes: r.totalBytes, segments: r.segments }).where(eq(schema.mediaObjects.id, media.id)).run();
  return json({ ok: true, stored: r.stored, segments: r.segments });
}, { limit: 400, name: "session-media" });
