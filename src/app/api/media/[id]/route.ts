import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyMediaSignature } from "@/lib/security/signed-url";
import { mediaInfo, readRange } from "@/lib/privacy/media-store";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Signed, short-lived, owner-only media streaming with HTTP range support (for
 * Playback seeking). Both the signature and the signed-in owner are required.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (!rateLimit(`media:${user.id}`, 600, 60_000).ok) return new Response("Too many requests", { status: 429 });
  const url = new URL(req.url);
  if (!verifyMediaSignature(id, user.id, url.searchParams.get("exp"), url.searchParams.get("sig"))) return new Response("Link expired", { status: 403 });
  const media = getDb().select().from(schema.mediaObjects).where(eq(schema.mediaObjects.id, id)).get();
  if (!media || media.userId !== user.id || media.status === "deleted") return new Response("Not found", { status: 404 });
  if (media.expiresAt && media.expiresAt.getTime() < Date.now()) return new Response("This recording passed its retention period and was deleted", { status: 410 });
  const info = mediaInfo(user.id, id);
  if (!info || info.totalBytes === 0) return new Response("Not found", { status: 404 });
  const total = info.totalBytes;
  const range = req.headers.get("range");
  const baseHeaders = { "content-type": info.mimeType.split(";")[0], "accept-ranges": "bytes", "cache-control": "private, no-store" };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m?.[1] ? Number(m[1]) : 0;
    let end = m?.[2] ? Number(m[2]) : Math.min(total - 1, start + 2 * 1024 * 1024 - 1);
    if (!m?.[1] && m?.[2]) { start = Math.max(0, total - Number(m[2])); end = total - 1; }
    if (start >= total) return new Response(null, { status: 416, headers: { "content-range": `bytes */${total}` } });
    end = Math.min(end, total - 1);
    const body = readRange(user.id, id, start, end);
    return new Response(new Uint8Array(body), { status: 206, headers: { ...baseHeaders, "content-length": String(body.length), "content-range": `bytes ${start}-${end}/${total}` } });
  }
  const body = readRange(user.id, id, 0, total - 1);
  return new Response(new Uint8Array(body), { status: 200, headers: { ...baseHeaders, "content-length": String(body.length) } });
}
