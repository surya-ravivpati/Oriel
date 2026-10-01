import "server-only";
import { createHash } from "node:crypto";
import { CONSENT_COPY, CONSENT_VERSION, type ConsentCopyKey } from "./consent";

/** SHA-256 of the exact wording shown for a consent kind at the current version. */
export function consentTextHash(kind: string): string | null {
  const copy = (CONSENT_COPY as Record<string, string>)[kind as ConsentCopyKey];
  if (!copy) return null;
  const extra = kind === "camera_metrics" ? `\n${CONSENT_COPY.camera_metrics_release}` : "";
  return createHash("sha256").update(`${CONSENT_VERSION}\n${copy}${extra}`).digest("hex");
}
