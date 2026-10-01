import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "@/lib/id";
import { hashPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { createSession } from "@/lib/auth/session";
import { clientIp, errorResponse, json, parseBody } from "@/lib/api/http";
import { CONSENT_VERSION } from "@/lib/privacy/consent";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  acceptTerms: z.literal(true, { message: "Please accept the terms to continue" }),
});

export async function POST(req: Request) {
  try {
    const ip = await clientIp();
    if (!rateLimit(`signup:${ip}`, 10, 60 * 60_000).ok) return json({ error: "Too many sign-ups from this network. Try again later." }, { status: 429 });
    const body = await parseBody(req, Body);
    const db = getDb();
    if (db.select().from(schema.users).where(eq(schema.users.email, body.email)).get()) {
      return json({ error: "An account with that email already exists" }, { status: 409 });
    }
    const admins = (process.env.ORIEL_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const isFirst = (db.select({ n: count() }).from(schema.users).get()?.n ?? 0) === 0;
    const role = admins.includes(body.email) || (isFirst && process.env.NODE_ENV !== "production") ? "admin" : "user";
    const id = newId("usr");
    db.insert(schema.users).values({ id, email: body.email, passwordHash: await hashPassword(body.password), role }).run();
    db.insert(schema.consentRecords).values({ id: newId("cns"), userId: id, kind: "terms", version: CONSENT_VERSION, granted: true, userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null }).run();
    db.insert(schema.subscriptions).values({ id: newId("sub"), userId: id, plan: "free", periodStart: new Date() }).run();
    await createSession(id);
    audit("auth.signup", { userId: id, ip, data: { role } });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
