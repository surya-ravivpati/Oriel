import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { authed, json, parseBody } from "@/lib/api/http";
import { audit } from "@/lib/security/audit";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  targetRole: z.string().trim().min(2).max(120),
  domain: z.enum(["software", "product", "consulting", "finance", "research", "clinical", "executive", "government"]),
  experienceLevel: z.enum(["early", "mid", "senior", "executive"]),
  preferredInterviewType: z.enum(["behavioral", "technical", "case", "leadership", "mixed"]),
  preferredPersona: z.enum(["warm_recruiter", "hiring_manager", "skeptic", "executive"]),
});

export const POST = authed(async (req, { user }) => {
  const body = await parseBody(req, Body);
  const db = getDb();
  db.insert(schema.profiles).values({ userId: user.id, ...body }).onConflictDoUpdate({ target: schema.profiles.userId, set: { ...body, updatedAt: new Date() } }).run();
  db.update(schema.users).set({ onboardedAt: new Date() }).where(eq(schema.users.id, user.id)).run();
  db.insert(schema.ladderProgress).values({ userId: user.id, level: 1, unlockedAt: new Date() }).onConflictDoNothing().run();
  audit("profile.onboarded", { userId: user.id });
  return json({ ok: true });
}, { limit: 20 });
