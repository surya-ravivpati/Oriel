import { randomBytes } from "node:crypto";

/** URL-safe random id with a readable prefix, e.g. ses_3fK9... */
export function newId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}
