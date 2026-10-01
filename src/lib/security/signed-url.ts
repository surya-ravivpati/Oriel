import { createHmac, timingSafeEqual } from "node:crypto";
import { deriveKey } from "./secrets";

/** Short-lived HMAC-signed media URLs. The signature binds media id, user and expiry. */
export function signMediaUrl(mediaId: string, userId: string, ttlSec = 15 * 60): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = sign(`${mediaId}.${userId}.${exp}`);
  return `/api/media/${mediaId}?exp=${exp}&sig=${sig}`;
}

export function verifyMediaSignature(mediaId: string, userId: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(`${mediaId}.${userId}.${expNum}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function sign(payload: string) {
  return createHmac("sha256", deriveKey("media-url")).update(payload).digest("base64url");
}
