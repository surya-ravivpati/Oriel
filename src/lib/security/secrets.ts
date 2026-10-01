import { createHash, hkdfSync } from "node:crypto";

/**
 * Server-only secret material. In production ORIEL_SECRET must be set (32+ random bytes);
 * in development we derive a stable per-checkout secret so local data survives restarts.
 */
let cached: Buffer | null = null;

export function masterSecret(): Buffer {
  if (cached) return cached;
  const env = process.env.ORIEL_SECRET;
  if (env && env.length >= 32) {
    cached = Buffer.from(env, "utf8");
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ORIEL_SECRET must be set (>= 32 chars) in production");
    }
    cached = createHash("sha256").update(`oriel-dev-secret:${process.cwd()}`).digest();
  }
  return cached;
}

/** Derive an independent key for a purpose (and optionally a user) via HKDF. */
export function deriveKey(purpose: string, subject = ""): Buffer {
  return Buffer.from(hkdfSync("sha256", masterSecret(), Buffer.from(subject), Buffer.from(`oriel:${purpose}`), 32));
}
