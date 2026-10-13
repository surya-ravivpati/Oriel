import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { deriveKey } from "@/lib/security/secrets";

/**
 * Encrypted, append-only media storage.
 *
 * Recordings arrive as MediaRecorder chunks during the interview (so a crash never
 * loses what was already said). Each chunk is sealed independently with AES-256-GCM
 * under a per-user key derived from the server secret, with the media id and sequence
 * number bound as associated data. Independent segments allow byte-range reads (video
 * seeking) without decrypting the whole file.
 *
 * Where the bytes live: a local folder by default, or a private Vercel Blob store when
 * BLOB_READ_WRITE_TOKEN is set (serverless hosts have no lasting disk). Either way the
 * store only ever sees ciphertext.
 */
export interface SegmentIndexEntry { seq: number; offset: number; length: number }
interface MediaIndex { mediaId: string; userId: string; mimeType: string; segments: SegmentIndexEntry[]; totalBytes: number }

// Recordings are runtime data, never build input. Every path goes through `at`, whose ignore
// comment stops the build from tracing (and so shipping) stored media into the server bundle.
const at = (...parts: string[]) => path.join(/*turbopackIgnore: true*/ ...parts);

export function mediaRoot() {
  return process.env.MEDIA_DIR ?? at(process.cwd(), "data", "media");
}

/** Where objects live. Keys are "userId/mediaId/name". */
interface Store {
  read(key: string): Promise<Buffer | null>;
  write(key: string, data: Buffer | string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
}

const diskStore: Store = {
  async read(key) {
    try { return await fs.promises.readFile(at(mediaRoot(), key)); } catch { return null; }
  },
  async write(key, data) {
    const file = at(mediaRoot(), key);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.promises.writeFile(tmp, data);
    await fs.promises.rename(tmp, file);
  },
  async removePrefix(prefix) {
    await fs.promises.rm(at(mediaRoot(), prefix), { recursive: true, force: true });
  },
};

const BLOB_PREFIX = "media/";
const blobStore: Store = {
  async read(key) {
    const res = await get(BLOB_PREFIX + key, { access: "private", useCache: false }).catch(() => null);
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  },
  async write(key, data) {
    await put(BLOB_PREFIX + key, data, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream" });
  },
  async removePrefix(prefix) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BLOB_PREFIX + prefix + "/", cursor });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  },
};

const store = (): Store => (process.env.BLOB_READ_WRITE_TOKEN ? blobStore : diskStore);

function keyFor(userId: string, mediaId: string) {
  if (!/^[\w-]+$/.test(userId) || !/^[\w-]+$/.test(mediaId)) throw new Error("invalid media path");
  return `${userId}/${mediaId}`;
}

async function readIndex(key: string): Promise<MediaIndex | null> {
  const buf = await store().read(`${key}/index.json`);
  return buf ? JSON.parse(buf.toString("utf8")) : null;
}

async function writeIndex(key: string, idx: MediaIndex) {
  await store().write(`${key}/index.json`, JSON.stringify(idx));
}

export async function createMedia(userId: string, mediaId: string, mimeType: string) {
  const key = keyFor(userId, mediaId);
  if (!(await readIndex(key))) await writeIndex(key, { mediaId, userId, mimeType, segments: [], totalBytes: 0 });
  return key;
}

/** Append a chunk. Idempotent for retried uploads of an already-stored sequence. */
export async function appendSegment(userId: string, mediaId: string, seq: number, plaintext: Buffer): Promise<{ stored: boolean; totalBytes: number; segments: number }> {
  const key = keyFor(userId, mediaId);
  const idx = await readIndex(key);
  if (!idx) throw new Error("unknown media");
  if (seq < idx.segments.length) return { stored: false, totalBytes: idx.totalBytes, segments: idx.segments.length };
  if (seq !== idx.segments.length) throw new Error(`out-of-order segment ${seq}, expected ${idx.segments.length}`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("media", userId), iv);
  cipher.setAAD(Buffer.from(`${mediaId}:${seq}`));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  await store().write(`${key}/${segName(seq)}`, Buffer.concat([iv, cipher.getAuthTag(), ct]));
  idx.segments.push({ seq, offset: idx.totalBytes, length: plaintext.length });
  idx.totalBytes += plaintext.length;
  await writeIndex(key, idx);
  return { stored: true, totalBytes: idx.totalBytes, segments: idx.segments.length };
}

function segName(seq: number) {
  return `seg-${String(seq).padStart(6, "0")}.bin`;
}

async function decryptSegment(key: string, userId: string, mediaId: string, seq: number): Promise<Buffer> {
  const buf = await store().read(`${key}/${segName(seq)}`);
  if (!buf) throw new Error("missing media segment");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("media", userId), buf.subarray(0, 12));
  decipher.setAAD(Buffer.from(`${mediaId}:${seq}`));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

export async function mediaInfo(userId: string, mediaId: string): Promise<{ totalBytes: number; mimeType: string } | null> {
  const idx = await readIndex(keyFor(userId, mediaId));
  return idx ? { totalBytes: idx.totalBytes, mimeType: idx.mimeType } : null;
}

/** Read plaintext bytes [start, end] inclusive. */
export async function readRange(userId: string, mediaId: string, start: number, end: number): Promise<Buffer> {
  const key = keyFor(userId, mediaId);
  const idx = await readIndex(key);
  if (!idx) throw new Error("unknown media");
  const parts: Buffer[] = [];
  for (const s of idx.segments) {
    const sEnd = s.offset + s.length - 1;
    if (sEnd < start || s.offset > end) continue;
    const plain = await decryptSegment(key, userId, mediaId, s.seq);
    const from = Math.max(0, start - s.offset);
    const to = Math.min(s.length, end - s.offset + 1);
    parts.push(plain.subarray(from, to));
  }
  return Buffer.concat(parts);
}

export async function deleteMedia(userId: string, mediaId: string) {
  await store().removePrefix(keyFor(userId, mediaId));
}

export async function deleteAllMediaForUser(userId: string) {
  if (!/^[\w-]+$/.test(userId)) throw new Error("invalid user id");
  await store().removePrefix(userId);
}
