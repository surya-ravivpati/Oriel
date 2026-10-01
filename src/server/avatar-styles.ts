import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { audit } from "@/lib/security/audit";
import type { AvatarStyle } from "@/lib/avatar/style";
import type { PersonaId } from "@/lib/interview/personas";

export type SavedStyles = Partial<Record<PersonaId, AvatarStyle>>;

export function savedStyles(userId: string): SavedStyles {
  const row = getDb().select({ styles: schema.profiles.avatarStyles }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  return (row?.styles ?? {}) as SavedStyles;
}

/** Save (or with null, reset) one interviewer's look and name for this person. */
export function saveStyle(userId: string, personaId: PersonaId, style: AvatarStyle | null): SavedStyles {
  const next: SavedStyles = { ...savedStyles(userId) };
  if (style) next[personaId] = style;
  else delete next[personaId];
  getDb().update(schema.profiles).set({ avatarStyles: next, updatedAt: new Date() }).where(eq(schema.profiles.userId, userId)).run();
  audit("avatar.style", { userId, data: { personaId, reset: !style } });
  return next;
}
