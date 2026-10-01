import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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
 * Swap this module for an S3/GCS implementation with the same interface in production.
 */
export interface SegmentIndexEntry { seq: number; offset: number; length: number }
interface MediaIndex { mediaId: string; userId: string; mimeType: string; segments: SegmentIndexEntry[]; totalBytes: number }

// Recordings are runtime data, never build input. Every path goes through `at`, whose ignore
// comment stops the build from tracing (and so shipping) stored media into the server bundle.
const at = (...parts: string[]) => path.join(/*turbopackIgnore: true*/ ...parts);

export function mediaRoot() {
  return process.env.MEDIA_DIR ?? at(process.cwd(), "data", "media");
}

function dirFor(userId: string, mediaId: string) {
  if (!/^[\w-]+$/.test(userId) || !/^[\w-]+$/.test(mediaId)) throw new Error("invalid media path");
  return at(mediaRoot(), userId, mediaId);
}

function readIndex(dir: string): MediaIndex {
  return JSON.parse(fs.readFileSync(at(dir, "index.json"), "utf8"));
}

function writeIndex(dir: string, idx: MediaIndex) {
  const tmp = at(dir, "index.json.tmp");
  fs.writeFileSync(tmp, JSON.stringify(idx));
  fs.renameSync(tmp, at(dir, "index.json"));
}

export function createMedia(userId: string, mediaId: string, mimeType: string) {
  const dir = dirFor(userId, mediaId);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(at(dir, "index.json"))) {
    writeIndex(dir, { mediaId, userId, mimeType, segments: [], totalBytes: 0 });
  }
  return `${userId}/${mediaId}`;
}

/** Append a chunk. Idempotent for retried uploads of an already-stored sequence. */
export function appendSegment(userId: string, mediaId: string, seq: number, plaintext: Buffer): { stored: boolean; totalBytes: number; segments: number } {
  const dir = dirFor(userId, mediaId);
  const idx = readIndex(dir);
  if (seq < idx.segments.length) return { stored: false, totalBytes: idx.totalBytes, segments: idx.segments.length };
  if (seq !== idx.segments.length) throw new Error(`out-of-order segment ${seq}, expected ${idx.segments.length}`);
  const key = deriveKey("media", userId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${mediaId}:${seq}`));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  fs.writeFileSync(at(dir, segName(seq)), Buffer.concat([iv, tag, ct]));
  idx.segments.push({ seq, offset: idx.totalBytes, length: plaintext.length });
  idx.totalBytes += plaintext.length;
  writeIndex(dir, idx);
  return { stored: true, totalBytes: idx.totalBytes, segments: idx.segments.length };
}

function segName(seq: number) {
  return `seg-${String(seq).padStart(6, "0")}.bin`;
}

function decryptSegment(dir: string, userId: string, mediaId: string, seq: number): Buffer {
  const buf = fs.readFileSync(at(dir, segName(seq)));
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("media", userId), iv);
  decipher.setAAD(Buffer.from(`${mediaId}:${seq}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

export function mediaInfo(userId: string, mediaId: string): { totalBytes: number; mimeType: string } | null {
  const dir = dirFor(userId, mediaId);
  if (!fs.existsSync(at(dir, "index.json"))) return null;
  const idx = readIndex(dir);
  return { totalBytes: idx.totalBytes, mimeType: idx.mimeType };
}

/** Read plaintext bytes [start, end] inclusive. */
export function readRange(userId: string, mediaId: string, start: number, end: number): Buffer {
  const dir = dirFor(userId, mediaId);
  const idx = readIndex(dir);
  const parts: Buffer[] = [];
  for (const s of idx.segments) {
    const sEnd = s.offset + s.length - 1;
    if (sEnd < start || s.offset > end) continue;
    const plain = decryptSegment(dir, userId, mediaId, s.seq);
    const from = Math.max(0, start - s.offset);
    const to = Math.min(s.length, end - s.offset + 1);
    parts.push(plain.subarray(from, to));
  }
  return Buffer.concat(parts);
}

export function deleteMedia(userId: string, mediaId: string) {
  fs.rmSync(dirFor(userId, mediaId), { recursive: true, force: true });
}

export function deleteAllMediaForUser(userId: string) {
  if (!/^[\w-]+$/.test(userId)) throw new Error("invalid user id");
  fs.rmSync(at(mediaRoot(), userId), { recursive: true, force: true });
}
