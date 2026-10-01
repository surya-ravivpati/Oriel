import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export const SESSION_COOKIE = "oriel_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CurrentUser = { id: string; email: string; role: "user" | "admin"; onboarded: boolean; name: string | null };

const hashToken = (t: string) => createHash("sha256").update(t).digest("base64url");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  getDb().insert(schema.authSessions).values({
    id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS), userAgent: ua,
  }).run();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) getDb().delete(schema.authSessions).where(eq(schema.authSessions.id, hashToken(token))).run();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role, onboardedAt: schema.users.onboardedAt, name: schema.profiles.name })
    .from(schema.authSessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.authSessions.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(and(eq(schema.authSessions.id, hashToken(token)), gt(schema.authSessions.expiresAt, new Date()), isNull(schema.users.deletedAt)))
    .get();
  if (!row) return null;
  return { id: row.id, email: row.email, role: row.role, onboarded: !!row.onboardedAt, name: row.name ?? null };
}

/** For server components/pages: redirect to login (or onboarding) when needed. */
export async function requireUser(opts: { allowUnonboarded?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!opts.allowUnonboarded && !user.onboarded) redirect("/onboarding");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/home");
  return user;
}
