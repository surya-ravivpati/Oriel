import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { audit } from "@/lib/security/audit";
import type { AvatarStyle } from "@/lib/avatar/style";
import type { PersonaId } from "@/lib/interview/personas";

export type SavedStyles = Partial<Record<PersonaId, AvatarStyle>>;

export async function savedStyles(userId: string): Promise<SavedStyles> {
  const row = await getDb().select({ styles: schema.profiles.avatarStyles }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
  return (row?.styles ?? {}) as SavedStyles;
}

/** Save (or with null, reset) one interviewer's look and name for this person. */
export async function saveStyle(userId: string, personaId: PersonaId, style: AvatarStyle | null): Promise<SavedStyles> {
  const next: SavedStyles = { ...await savedStyles(userId) };
  if (style) next[personaId] = style;
  else delete next[personaId];
  await getDb().update(schema.profiles).set({ avatarStyles: next, updatedAt: new Date() }).where(eq(schema.profiles.userId, userId)).run();
  await audit("avatar.style", { userId, data: { personaId, reset: !style } });
  return next;
}
